"use client"

import type { AIEvent } from "@ifc-viewer/core"
import type { GetConversationResponse, ListConversationsResponse } from "@ifc-viewer/sdk"
import { fetchSSE } from "@ifc-viewer/sdk"
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
  useRef,
  useState,
} from "react"
import {
  type StreamingMessage,
  toStreamingMessages,
  type UIMessagePart,
  type UIToolPart,
} from "./types"

// ============================================================================
// Types
// ============================================================================

type Conversation = ListConversationsResponse[number]

interface StreamingToolState {
  id: string
  name: string
  buffer: string
  lastContentLength: number
  lastPath: string | null
  currentLine: number
  currentColumn: number
}

interface AgentContextValue {
  messages: StreamingMessage[]
  isLoading: boolean
  conversationId: string | null
  conversations: Conversation[]
  sendMessage: (content: string) => void
  stop: () => void
  clearMessages: () => void
  deselectConversation: () => void
  selectConversation: (conversationId: string) => void
  createNewConversation: () => Promise<void>
  deleteConversation: (conversationId: string) => Promise<void>
  onPresenceEvent: (callback: (event: AIEvent) => void) => () => void
}

const AgentContext = createContext<AgentContextValue | null>(null)

// ============================================================================
// Helpers
// ============================================================================

function getSessionStorageKey(projectId: string): string {
  return `ifc-viewer:conversation:${projectId}`
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

// ============================================================================
// Provider
// ============================================================================

interface AgentProviderProps {
  projectId: string
  children: ReactNode
}

export function AgentProvider({ projectId, children }: AgentProviderProps) {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<StreamingMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(() => {
    return sessionStorage.getItem(getSessionStorageKey(projectId))
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const presenceCallbacksRef = useRef<Set<(event: AIEvent) => void>>(new Set())
  const currentStepRef = useRef<number>(0)
  const streamingToolsRef = useRef<Map<string, StreamingToolState>>(new Map())
  const isActivelyStreamingRef = useRef(false)

  const apiUrl = import.meta.env.VITE_API_URL || ""

  // ============================================================================
  // Queries & Mutations
  // ============================================================================

  const conversationsQuery = useQuery({
    ...listConversationsOptions({ path: { id: projectId } }),
  })

  const conversations = conversationsQuery.data ?? []

  const createConvMutation = useMutation({ ...createConversationMutation() })
  const deleteConvMutation = useMutation({ ...deleteConversationMutation() })
  const stopMutation = useMutation({ ...stopGenerationMutation() })

  // ============================================================================
  // Event Handling
  // ============================================================================

  const emitPresenceEvent = useCallback((event: AIEvent) => {
    for (const callback of presenceCallbacksRef.current) {
      callback(event)
    }
  }, [])

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
            id: event.id,
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

        case "finish":
          setIsLoading(false)
          currentStepRef.current = 0
          streamingToolsRef.current.clear()
          setMessages((prev) => {
            const lastIdx = prev.length - 1
            const lastMsg = prev[lastIdx]
            if (lastMsg?.role !== "assistant") return prev

            const newParts = (lastMsg.parts || []).map((p) =>
              isToolPart(p) &&
              (p.state === "running" || p.state === "pending" || p.state === "streaming")
                ? { ...p, state: "completed" as const }
                : p
            )

            return [...prev.slice(0, lastIdx), { ...lastMsg, parts: newParts }]
          })
          break

        case "error":
          setIsLoading(false)
          currentStepRef.current = 0
          streamingToolsRef.current.clear()
          console.error("[Agent] Error:", event.message)
          break
      }
    },
    [emitPresenceEvent]
  )

  // ============================================================================
  // Conversation Loading
  // ============================================================================

  // Save conversationId to session storage
  useEffect(() => {
    if (conversationId) {
      sessionStorage.setItem(getSessionStorageKey(projectId), conversationId)
    } else {
      sessionStorage.removeItem(getSessionStorageKey(projectId))
    }
  }, [conversationId, projectId])

  // Load conversation: check isGenerating, connect to /events if needed
  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }

    // Don't interfere if sendMessage is actively streaming
    if (isActivelyStreamingRef.current) return

    const convId = conversationId
    let cancelled = false
    const controller = new AbortController()

    async function loadConversation() {
      try {
        // Fetch conversation (includes isGenerating flag)
        const convRes = await fetch(`${apiUrl}/api/projects/${projectId}/conversations/${convId}`)

        if (!convRes.ok || cancelled) return

        const conv = (await convRes.json()) as GetConversationResponse
        const dbMessages = toStreamingMessages(conv.messages)

        if (conv.isGenerating) {
          // Active generation - connect to /events
          console.log("[Agent] Reconnecting to active generation")

          // Get user messages, add empty assistant for streaming
          const userMessages = dbMessages.filter((m) => m.role === "user")
          setMessages([
            ...userMessages,
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

          // Connect to events stream
          await fetchSSE<AIEvent>({
            url: `${apiUrl}/api/projects/${projectId}/conversations/${convId}/events`,
            method: "GET",
            onEvent: handleAIEvent,
            signal: controller.signal,
            eventName: "message",
          })

          if (!cancelled) {
            setIsLoading(false)
            abortControllerRef.current = null
          }
        } else {
          // No active generation - just show messages from DB
          if (!cancelled) {
            setMessages(dbMessages)
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[Agent] Failed to load conversation:", error)
        }
      }
    }

    loadConversation()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [conversationId, projectId, handleAIEvent])

  // ============================================================================
  // Conversation Management
  // ============================================================================

  const selectConversation = useCallback((convId: string) => {
    setConversationId(convId)
  }, [])

  const deselectConversation = useCallback(() => {
    setConversationId(null)
  }, [])

  const createNewConversation = useCallback(async () => {
    try {
      const result = await createConvMutation.mutateAsync({
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
  }, [createConvMutation, projectId])

  const deleteConversationHandler = useCallback(
    async (convId: string) => {
      try {
        await deleteConvMutation.mutateAsync({
          path: { id: projectId, conversationId: convId },
        })
        queryClient.invalidateQueries({
          queryKey: listConversationsQueryKey({ path: { id: projectId } }),
        })
        if (convId === conversationId) {
          setConversationId(null)
        }
      } catch (error) {
        console.error("[Agent] Failed to delete conversation:", error)
      }
    },
    [deleteConvMutation, projectId, conversationId, queryClient]
  )

  // ============================================================================
  // Chat
  // ============================================================================

  const sendMessage = useCallback(
    async (content: string) => {
      abortControllerRef.current?.abort()
      isActivelyStreamingRef.current = true

      const controller = new AbortController()
      abortControllerRef.current = controller

      // Create conversation if needed
      let activeConvId = conversationId
      if (!activeConvId) {
        try {
          const conv = await createConvMutation.mutateAsync({
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

      // Optimistically add user message + empty assistant message
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
        // POST to /messages to start generation
        const res = await fetch(
          `${apiUrl}/api/projects/${projectId}/conversations/${activeConvId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          }
        )

        if (!res.ok) {
          throw new Error(`Failed to send message: ${res.status}`)
        }

        // Connect to /events to receive generation events
        await fetchSSE<AIEvent>({
          url: `${apiUrl}/api/projects/${projectId}/conversations/${activeConvId}/events`,
          method: "GET",
          onEvent: handleAIEvent,
          signal: controller.signal,
          eventName: "message",
        })
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
    [projectId, conversationId, createConvMutation, handleAIEvent, queryClient]
  )

  const stop = useCallback(async () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    isActivelyStreamingRef.current = false

    if (conversationId) {
      try {
        await stopMutation.mutateAsync({ path: { id: projectId, conversationId } })
      } catch (error) {
        if (!(error instanceof Error && error.message.includes("404"))) {
          console.error("[Agent] Failed to stop:", error)
        }
      }
    }

    setIsLoading(false)
    streamingToolsRef.current.clear()
  }, [stopMutation, projectId, conversationId])

  const clearMessages = useCallback(async () => {
    if (conversationId) {
      try {
        await deleteConvMutation.mutateAsync({ path: { id: projectId, conversationId } })
        queryClient.invalidateQueries({
          queryKey: listConversationsQueryKey({ path: { id: projectId } }),
        })
      } catch (error) {
        console.error("[Agent] Failed to delete conversation:", error)
      }
    }
    setConversationId(null)
    setMessages([])
  }, [deleteConvMutation, projectId, conversationId, queryClient])

  const onPresenceEvent = useCallback((callback: (event: AIEvent) => void) => {
    presenceCallbacksRef.current.add(callback)
    return () => {
      presenceCallbacksRef.current.delete(callback)
    }
  }, [])

  return (
    <AgentContext.Provider
      value={{
        messages,
        isLoading,
        conversationId,
        conversations,
        sendMessage,
        stop,
        clearMessages,
        deselectConversation,
        selectConversation,
        createNewConversation,
        deleteConversation: deleteConversationHandler,
        onPresenceEvent,
      }}
    >
      {children}
    </AgentContext.Provider>
  )
}

export function useAgent() {
  const context = useContext(AgentContext)
  if (!context) {
    throw new Error("useAgent must be used within an AgentProvider")
  }
  return context
}
