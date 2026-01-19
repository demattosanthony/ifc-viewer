"use client"

import type { AIEvent } from "@ifc-viewer/core"
import type { ListConversationsResponse } from "@ifc-viewer/sdk"
import { fetchSSE, getConversation, sendMessage as sendMessageApi } from "@ifc-viewer/sdk"
import {
  createConversationMutation,
  deleteConversationMutation,
  listConversationsOptions,
  listConversationsQueryKey,
  stopGenerationMutation,
} from "@ifc-viewer/sdk/hooks"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  type StreamingMessage,
  toStreamingMessages,
  type UIMessagePart,
  type UIReasoningPart,
  type UIToolPart,
} from "./types"

// =============================================================================
// Types
// =============================================================================

type Conversation = ListConversationsResponse[number]

interface StreamingToolState {
  name: string
  buffer: string
  lastContentLength: number
  lastPath: string | null
  currentLine: number
  currentColumn: number
}

/** Stable context - rarely changes (conversation management, presence events) */
interface AgentStoreContextValue {
  conversationId: string | null
  conversations: Conversation[]
  sendMessage: (content: string) => void
  stop: () => void
  clearMessages: () => void
  selectConversation: (id: string) => void
  deselectConversation: () => void
  createNewConversation: () => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  onPresenceEvent: (cb: (event: AIEvent) => void) => () => void
}

/** Streaming context - frequent changes during message streaming */
interface AgentMessagesContextValue {
  messages: StreamingMessage[]
  isLoading: boolean
}

// =============================================================================
// Contexts
// =============================================================================

const AgentStoreContext = createContext<AgentStoreContextValue | null>(null)
const AgentMessagesContext = createContext<AgentMessagesContextValue | null>(null)

// =============================================================================
// Constants
// =============================================================================

const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAY_MS = 1000
const API_URL = import.meta.env.VITE_API_URL || ""

// =============================================================================
// Helpers
// =============================================================================

function getSessionStorageKey(projectId: string): string {
  return `ifc-viewer:conversation:${projectId}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractStreamingField(buffer: string, fieldName: string): string | null {
  const pattern = `"${fieldName}":`
  const idx = buffer.indexOf(pattern)
  if (idx === -1) return null

  const afterColon = buffer.slice(idx + pattern.length).trimStart()
  if (!afterColon.startsWith('"')) return null

  let content = ""
  let escaped = false
  for (let i = 1; i < afterColon.length; i++) {
    const char = afterColon[i]
    if (escaped) {
      if (char === "n") content += "\n"
      else if (char === "t") content += "\t"
      else if (char === "r") content += "\r"
      else content += char
      escaped = false
    } else if (char === "\\") {
      escaped = true
    } else if (char === '"') {
      break
    } else {
      content += char
    }
  }
  return content
}

function isToolPart(part: UIMessagePart): part is UIToolPart {
  return part.type === "tool-use"
}

function isReasoningPart(part: UIMessagePart): part is UIReasoningPart {
  return part.type === "reasoning"
}

// =============================================================================
// Provider
// =============================================================================

interface AgentProviderProps {
  projectId: string
  children: ReactNode
}

export function AgentProvider({ projectId, children }: AgentProviderProps) {
  const queryClient = useQueryClient()

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [messages, setMessages] = useState<StreamingMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(() => {
    return sessionStorage.getItem(getSessionStorageKey(projectId))
  })

  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------

  const abortControllerRef = useRef<AbortController | null>(null)
  const presenceCallbacksRef = useRef<Set<(event: AIEvent) => void>>(new Set())
  const currentStepRef = useRef<number>(0)
  const streamingToolsRef = useRef<Map<string, StreamingToolState>>(new Map())
  const streamingReasoningRef = useRef<Map<string, string>>(new Map())
  const isActivelyStreamingRef = useRef(false)
  const streamFinishedRef = useRef(false)
  const streamTokenRef = useRef(0)

  // Keep current conversationId in ref for stable callbacks
  const conversationIdRef = useRef(conversationId)
  conversationIdRef.current = conversationId

  // -------------------------------------------------------------------------
  // Queries & Mutations
  // -------------------------------------------------------------------------

  const conversationsQuery = useQuery({
    ...listConversationsOptions({ path: { id: projectId } }),
  })

  const conversations = conversationsQuery.data ?? []

  const createConvMutation = useMutation({ ...createConversationMutation() })
  const deleteConvMutation = useMutation({ ...deleteConversationMutation() })
  const stopMutation = useMutation({ ...stopGenerationMutation() })

  // Store mutation functions in refs for stable callbacks
  const createConvRef = useRef(createConvMutation.mutateAsync)
  createConvRef.current = createConvMutation.mutateAsync
  const deleteConvRef = useRef(deleteConvMutation.mutateAsync)
  deleteConvRef.current = deleteConvMutation.mutateAsync
  const stopMutationRef = useRef(stopMutation.mutateAsync)
  stopMutationRef.current = stopMutation.mutateAsync

  // -------------------------------------------------------------------------
  // Event Handling
  // -------------------------------------------------------------------------

  const emitPresenceEvent = useCallback((event: AIEvent) => {
    for (const callback of presenceCallbacksRef.current) {
      callback(event)
    }
  }, [])

  const markInFlightTools = useCallback((message: string) => {
    setMessages((prev) => {
      const lastIdx = prev.length - 1
      const lastMsg = prev[lastIdx]
      if (!lastMsg || lastMsg.role !== "assistant" || !lastMsg.parts) return prev

      let updated = false
      const parts = lastMsg.parts.map((part) => {
        if (!isToolPart(part)) return part
        if (part.state === "completed" || part.state === "error") return part
        updated = true
        return { ...part, state: "error" as const, error: message }
      })

      if (!updated) return prev
      return [...prev.slice(0, lastIdx), { ...lastMsg, parts }]
    })
  }, [])

  const handleStreamEnd = useCallback(
    (streamToken: number, message: string) => {
      if (streamToken !== streamTokenRef.current) return
      if (streamFinishedRef.current) return
      streamFinishedRef.current = true
      markInFlightTools(message)
    },
    [markInFlightTools]
  )

  const handleAIEvent = useCallback(
    (event: AIEvent) => {
      emitPresenceEvent(event)

      switch (event.type) {
        case "step-start":
          currentStepRef.current = event.stepIndex
          break

        case "text-delta":
          setMessages((prev) => {
            const lastIdx = prev.length - 1
            const lastMsg = prev[lastIdx]
            if (lastMsg?.role !== "assistant") return prev

            const currentStep = currentStepRef.current
            const parts = [...(lastMsg.parts || [])]
            const lastPart = parts[parts.length - 1]

            if (lastPart?.type === "text" && lastPart.stepIndex === currentStep) {
              parts[parts.length - 1] = { ...lastPart, text: lastPart.text + event.content }
            } else {
              parts.push({ type: "text", text: event.content, stepIndex: currentStep })
            }

            return [
              ...prev.slice(0, lastIdx),
              { ...lastMsg, content: lastMsg.content + event.content, parts },
            ]
          })
          break

        case "tool-input-start":
          streamingToolsRef.current.set(event.id, {
            name: event.name,
            buffer: "",
            lastContentLength: 0,
            lastPath: null,
            currentLine: 0,
            currentColumn: 0,
          })
          setMessages((prev) => {
            const lastIdx = prev.length - 1
            const lastMsg = prev[lastIdx]
            if (lastMsg?.role !== "assistant") return prev

            const toolPart: UIToolPart = {
              type: "tool-use",
              id: event.id,
              name: event.name,
              input: {},
              state: "streaming",
              stepIndex: currentStepRef.current,
            }

            return [
              ...prev.slice(0, lastIdx),
              { ...lastMsg, parts: [...(lastMsg.parts || []), toolPart] },
            ]
          })
          break

        case "tool-input-delta": {
          const toolState = streamingToolsRef.current.get(event.id)
          if (!toolState) break

          toolState.buffer += event.delta
          const extractedInput: Record<string, unknown> = {}

          if (toolState.name === "writeFile") {
            const path = extractStreamingField(toolState.buffer, "path")
            const content = extractStreamingField(toolState.buffer, "content")

            if (path) {
              extractedInput.path = path
              if (path !== toolState.lastPath) {
                toolState.lastPath = path
                emitPresenceEvent({ type: "editor-open", path })
              }
            }

            if (content !== null) {
              extractedInput.content = content
              if (content.length > toolState.lastContentLength) {
                const newChunk = content.slice(toolState.lastContentLength)
                toolState.lastContentLength = content.length

                if (path) {
                  for (const char of newChunk) {
                    if (char === "\n") {
                      toolState.currentLine++
                      toolState.currentColumn = 0
                    } else {
                      emitPresenceEvent({
                        type: "editor-insert",
                        path,
                        position: { line: toolState.currentLine, column: toolState.currentColumn },
                        text: char,
                      })
                      toolState.currentColumn++
                    }
                  }
                }
              }
            }
          } else if (toolState.name === "executeCommand") {
            const command = extractStreamingField(toolState.buffer, "command")
            if (command !== null) {
              extractedInput.command = command
              if (command.length > toolState.lastContentLength) {
                const newChunk = command.slice(toolState.lastContentLength)
                toolState.lastContentLength = command.length
                emitPresenceEvent({ type: "terminal-append", text: newChunk })
              }
            }
          } else if (toolState.name === "executePython" || toolState.name === "executeViewer") {
            const code = extractStreamingField(toolState.buffer, "code")
            const title = extractStreamingField(toolState.buffer, "title")
            if (code !== null) extractedInput.code = code
            if (title !== null) extractedInput.title = title
          }

          if (Object.keys(extractedInput).length > 0) {
            setMessages((prev) => {
              const lastIdx = prev.length - 1
              const lastMsg = prev[lastIdx]
              if (lastMsg?.role !== "assistant") return prev

              const newParts = (lastMsg.parts || []).map((p) =>
                isToolPart(p) && p.id === event.id
                  ? { ...p, input: { ...p.input, ...extractedInput } }
                  : p
              )

              return [...prev.slice(0, lastIdx), { ...lastMsg, parts: newParts }]
            })
          }
          break
        }

        case "tool-input-end":
          streamingToolsRef.current.delete(event.id)
          break

        case "tool-call":
          setMessages((prev) => {
            const lastIdx = prev.length - 1
            const lastMsg = prev[lastIdx]
            if (lastMsg?.role !== "assistant") return prev

            const existingToolIdx = (lastMsg.parts || []).findIndex(
              (p) => isToolPart(p) && p.id === event.id
            )

            if (existingToolIdx >= 0) {
              const newParts = (lastMsg.parts || []).map((p) =>
                isToolPart(p) && p.id === event.id
                  ? { ...p, input: event.args, state: "running" as const }
                  : p
              )
              return [...prev.slice(0, lastIdx), { ...lastMsg, parts: newParts }]
            }

            const toolPart: UIToolPart = {
              type: "tool-use",
              id: event.id,
              name: event.name,
              input: event.args,
              state: "running",
              stepIndex: currentStepRef.current,
            }

            return [
              ...prev.slice(0, lastIdx),
              { ...lastMsg, parts: [...(lastMsg.parts || []), toolPart] },
            ]
          })
          break

        case "tool-result":
          setMessages((prev) => {
            const lastIdx = prev.length - 1
            const lastMsg = prev[lastIdx]
            if (lastMsg?.role !== "assistant") return prev

            const newParts = (lastMsg.parts || []).map((p) =>
              isToolPart(p) && p.id === event.id
                ? { ...p, output: event.result, state: "completed" as const }
                : p
            )

            return [...prev.slice(0, lastIdx), { ...lastMsg, parts: newParts }]
          })
          break

        case "reasoning-start":
          streamingReasoningRef.current.set(event.id, "")
          setMessages((prev) => {
            const lastIdx = prev.length - 1
            const lastMsg = prev[lastIdx]
            if (lastMsg?.role !== "assistant") return prev

            const reasoningPart: UIReasoningPart = {
              type: "reasoning",
              id: event.id,
              text: "",
              state: "streaming",
              stepIndex: currentStepRef.current,
            }

            return [
              ...prev.slice(0, lastIdx),
              { ...lastMsg, parts: [...(lastMsg.parts || []), reasoningPart] },
            ]
          })
          break

        case "reasoning-delta": {
          const currentText = streamingReasoningRef.current.get(event.id)
          if (currentText === undefined) break

          streamingReasoningRef.current.set(event.id, currentText + event.delta)

          setMessages((prev) => {
            const lastIdx = prev.length - 1
            const lastMsg = prev[lastIdx]
            if (lastMsg?.role !== "assistant") return prev

            const newParts = (lastMsg.parts || []).map((p) =>
              isReasoningPart(p) && p.id === event.id ? { ...p, text: p.text + event.delta } : p
            )

            return [...prev.slice(0, lastIdx), { ...lastMsg, parts: newParts }]
          })
          break
        }

        case "reasoning-end":
          streamingReasoningRef.current.delete(event.id)
          setMessages((prev) => {
            const lastIdx = prev.length - 1
            const lastMsg = prev[lastIdx]
            if (lastMsg?.role !== "assistant") return prev

            const newParts = (lastMsg.parts || []).map((p) =>
              isReasoningPart(p) && p.id === event.id ? { ...p, state: "done" as const } : p
            )

            return [...prev.slice(0, lastIdx), { ...lastMsg, parts: newParts }]
          })
          break

        case "finish":
          streamFinishedRef.current = true
          setIsLoading(false)
          currentStepRef.current = 0
          streamingToolsRef.current.clear()
          streamingReasoningRef.current.clear()
          setMessages((prev) => {
            const lastIdx = prev.length - 1
            const lastMsg = prev[lastIdx]
            if (lastMsg?.role !== "assistant") return prev

            const newParts = (lastMsg.parts || []).map((p) => {
              if (
                isToolPart(p) &&
                (p.state === "running" || p.state === "pending" || p.state === "streaming")
              ) {
                return { ...p, state: "completed" as const }
              }
              if (isReasoningPart(p) && p.state === "streaming") {
                return { ...p, state: "done" as const }
              }
              return p
            })

            return [...prev.slice(0, lastIdx), { ...lastMsg, parts: newParts }]
          })
          break

        case "error":
          streamFinishedRef.current = true
          setIsLoading(false)
          currentStepRef.current = 0
          streamingToolsRef.current.clear()
          streamingReasoningRef.current.clear()
          markInFlightTools(event.message)
          console.error("[Agent] Error:", event.message)
          break

        case "heartbeat":
          // Keep-alive, no action needed
          break
      }
    },
    [emitPresenceEvent, markInFlightTools]
  )

  // -------------------------------------------------------------------------
  // SSE Connection with reconnection support
  // -------------------------------------------------------------------------

  const connectToEvents = useCallback(
    async (
      convId: string,
      streamToken: number,
      controller: AbortController,
      cancelled: { current: boolean }
    ): Promise<void> => {
      let reconnectAttempts = 0

      const connect = async (): Promise<void> => {
        await fetchSSE<AIEvent>({
          url: `${API_URL}/api/projects/${projectId}/conversations/${convId}/events`,
          method: "GET",
          onEvent: handleAIEvent,
          onComplete: () => {
            if (!cancelled.current) handleStreamEnd(streamToken, "Cancelled")
          },
          onError: async (error) => {
            const shouldReconnect =
              !cancelled.current &&
              streamToken === streamTokenRef.current &&
              !streamFinishedRef.current &&
              !controller.signal.aborted &&
              reconnectAttempts < MAX_RECONNECT_ATTEMPTS

            if (shouldReconnect) {
              reconnectAttempts++
              console.log(
                `[Agent] Reconnecting (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}):`,
                error.message
              )

              await delay(RECONNECT_DELAY_MS * reconnectAttempts)

              try {
                const { data: conv } = await getConversation({
                  path: { id: projectId, conversationId: convId },
                })

                if (conv?.isGenerating && !cancelled.current && !controller.signal.aborted) {
                  await connect()
                  return
                }
              } catch {
                console.error("[Agent] Failed to check generation status")
              }
            }

            if (!cancelled.current) handleStreamEnd(streamToken, error.message)
          },
          signal: controller.signal,
          eventName: "message",
        })
      }

      await connect()
    },
    [projectId, handleAIEvent, handleStreamEnd]
  )

  // -------------------------------------------------------------------------
  // Session storage sync
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (conversationId) {
      sessionStorage.setItem(getSessionStorageKey(projectId), conversationId)
    } else {
      sessionStorage.removeItem(getSessionStorageKey(projectId))
    }
  }, [conversationId, projectId])

  // -------------------------------------------------------------------------
  // Load conversation on mount or switch
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }

    if (isActivelyStreamingRef.current) return

    const convId = conversationId
    const cancelled = { current: false }
    const controller = new AbortController()

    async function loadConversation() {
      try {
        const { data: conv, error } = await getConversation({
          path: { id: projectId, conversationId: convId },
        })

        if (error || !conv || cancelled.current) return
        const dbMessages = toStreamingMessages(conv.messages)

        if (conv.isGenerating) {
          console.log("[Agent] Reconnecting to active generation")

          setMessages([
            ...dbMessages,
            {
              id: `msg-replay-${Date.now()}`,
              role: "assistant",
              content: "",
              parts: [],
              createdAt: new Date(),
            },
          ])
          setIsLoading(true)
          abortControllerRef.current = controller
          streamFinishedRef.current = false
          const streamToken = ++streamTokenRef.current

          await connectToEvents(convId, streamToken, controller, cancelled)

          if (!cancelled.current) {
            setIsLoading(false)
            abortControllerRef.current = null
          }
        } else {
          if (!cancelled.current) setMessages(dbMessages)
        }
      } catch (error) {
        if (!cancelled.current) console.error("[Agent] Failed to load conversation:", error)
      }
    }

    loadConversation()

    return () => {
      cancelled.current = true
      controller.abort()
    }
  }, [conversationId, projectId, connectToEvents])

  // -------------------------------------------------------------------------
  // Conversation Management Actions (stable callbacks)
  // -------------------------------------------------------------------------

  const selectConversation = useCallback((convId: string) => setConversationId(convId), [])
  const deselectConversation = useCallback(() => setConversationId(null), [])

  const createNewConversation = useCallback(async () => {
    try {
      const result = await createConvRef.current({
        path: { id: projectId },
        body: {},
      })
      if (result) {
        setConversationId(result.id)
        setMessages([])
      }
    } catch (error) {
      console.error("[Agent] Failed to create conversation:", error)
    }
  }, [projectId])

  const deleteConversationHandler = useCallback(
    async (convId: string) => {
      try {
        await deleteConvRef.current({
          path: { id: projectId, conversationId: convId },
        })
        queryClient.invalidateQueries({
          queryKey: listConversationsQueryKey({ path: { id: projectId } }),
        })
        if (convId === conversationIdRef.current) setConversationId(null)
      } catch (error) {
        console.error("[Agent] Failed to delete conversation:", error)
      }
    },
    [projectId, queryClient]
  )

  // -------------------------------------------------------------------------
  // Chat Actions (stable callbacks)
  // -------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (content: string) => {
      abortControllerRef.current?.abort()
      markInFlightTools("Cancelled")
      streamFinishedRef.current = true
      isActivelyStreamingRef.current = true

      const controller = new AbortController()
      abortControllerRef.current = controller

      let activeConvId = conversationIdRef.current
      if (!activeConvId) {
        try {
          const conv = await createConvRef.current({
            path: { id: projectId },
            body: {},
          })
          if (!conv) return
          activeConvId = conv.id
          setConversationId(activeConvId)
          queryClient.invalidateQueries({
            queryKey: listConversationsQueryKey({ path: { id: projectId } }),
          })
        } catch (error) {
          console.error("[Agent] Failed to create conversation:", error)
          isActivelyStreamingRef.current = false
          return
        }
      }

      const userMessage: StreamingMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content,
        createdAt: new Date(),
      }

      const assistantMessage: StreamingMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: "",
        parts: [],
        createdAt: new Date(),
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      setIsLoading(true)

      try {
        const { error } = await sendMessageApi({
          path: { id: projectId, conversationId: activeConvId },
          body: { content },
        })

        if (error) throw new Error("Failed to send message")

        streamFinishedRef.current = false
        const streamToken = ++streamTokenRef.current
        const cancelled = { current: false }

        await connectToEvents(activeConvId, streamToken, controller, cancelled)
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          console.error("[Agent] Error:", error)
        }
      } finally {
        setIsLoading(false)
        isActivelyStreamingRef.current = false
        abortControllerRef.current = null
        queryClient.invalidateQueries({
          queryKey: listConversationsQueryKey({ path: { id: projectId } }),
        })
      }
    },
    [projectId, connectToEvents, markInFlightTools, queryClient]
  )

  const stop = useCallback(async () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    markInFlightTools("Cancelled")
    streamFinishedRef.current = true
    isActivelyStreamingRef.current = false

    const convId = conversationIdRef.current
    if (convId) {
      try {
        await stopMutationRef.current({ path: { id: projectId, conversationId: convId } })
      } catch (error) {
        if (!(error instanceof Error && error.message.includes("404"))) {
          console.error("[Agent] Failed to stop:", error)
        }
      }
    }

    setIsLoading(false)
    streamingToolsRef.current.clear()
  }, [projectId, markInFlightTools])

  const clearMessages = useCallback(async () => {
    const convId = conversationIdRef.current
    if (convId) {
      try {
        await deleteConvRef.current({ path: { id: projectId, conversationId: convId } })
        queryClient.invalidateQueries({
          queryKey: listConversationsQueryKey({ path: { id: projectId } }),
        })
      } catch (error) {
        console.error("[Agent] Failed to delete conversation:", error)
      }
    }
    setConversationId(null)
    setMessages([])
  }, [projectId, queryClient])

  const onPresenceEvent = useCallback((callback: (event: AIEvent) => void) => {
    presenceCallbacksRef.current.add(callback)
    return () => {
      presenceCallbacksRef.current.delete(callback)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Context Values (memoized to prevent unnecessary re-renders)
  // -------------------------------------------------------------------------

  // Store context: stable values that rarely change
  const storeValue = useMemo<AgentStoreContextValue>(
    () => ({
      conversationId,
      conversations,
      sendMessage,
      stop,
      clearMessages,
      selectConversation,
      deselectConversation,
      createNewConversation,
      deleteConversation: deleteConversationHandler,
      onPresenceEvent,
    }),
    [
      conversationId,
      conversations,
      sendMessage,
      stop,
      clearMessages,
      selectConversation,
      deselectConversation,
      createNewConversation,
      deleteConversationHandler,
      onPresenceEvent,
    ]
  )

  // Messages context: streaming values that change frequently
  const messagesValue = useMemo<AgentMessagesContextValue>(
    () => ({
      messages,
      isLoading,
    }),
    [messages, isLoading]
  )

  return (
    <AgentStoreContext.Provider value={storeValue}>
      <AgentMessagesContext.Provider value={messagesValue}>
        {children}
      </AgentMessagesContext.Provider>
    </AgentStoreContext.Provider>
  )
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Access stable agent store values (conversation management, presence events).
 * Does NOT re-render during message streaming.
 * Use this for components that only need conversationId or onPresenceEvent.
 */
export function useAgentStore(): AgentStoreContextValue {
  const context = useContext(AgentStoreContext)
  if (!context) throw new Error("useAgentStore must be used within an AgentProvider")
  return context
}

/**
 * Full agent hook - combines store and messages.
 * Re-renders during message streaming.
 */
export function useAgent() {
  const store = useAgentStore()
  const messagesCtx = useContext(AgentMessagesContext)
  if (!messagesCtx) throw new Error("useAgent must be used within an AgentProvider")
  return { ...store, ...messagesCtx }
}
