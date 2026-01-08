"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSSE } from "@ifc-viewer/sdk";
import type {
  AgentMessage,
  ToolInvocation,
  MessagePart,
  AIEvent,
} from "@ifc-viewer/core";
import {
  listConversationsOptions,
  listConversationsQueryKey,
  getConversationOptions,
  createConversationMutation,
  deleteConversationMutation,
  stopGenerationMutation,
} from "@ifc-viewer/sdk/hooks";
import type {
  ListConversationsResponse,
  GetConversationResponse,
} from "@ifc-viewer/sdk";

// ============================================================================
// Types
// ============================================================================

/** Conversation type from API (derived from SDK) */
type Conversation = ListConversationsResponse[number];

/** Conversation with messages from API (derived from SDK) */
type ConversationWithMessages = GetConversationResponse;

interface StreamingToolState {
  id: string;
  name: string;
  buffer: string;
  lastContentLength: number;
  lastPath: string | null;
  currentLine: number;
  currentColumn: number;
}

interface AgentContextValue {
  messages: AgentMessage[];
  isLoading: boolean;
  conversationId: string | null;
  conversations: Conversation[];
  sendMessage: (content: string) => void;
  stop: () => void;
  clearMessages: () => void;
  deselectConversation: () => void;
  selectConversation: (conversationId: string) => Promise<void>;
  createNewConversation: () => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  onPresenceEvent: (callback: (event: AIEvent) => void) => () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

// ============================================================================
// Helpers
// ============================================================================

function extractStreamingField(
  buffer: string,
  fieldName: string
): string | null {
  const pattern = `"${fieldName}":`;
  const idx = buffer.indexOf(pattern);
  if (idx === -1) return null;

  const afterColon = buffer.slice(idx + pattern.length).trimStart();
  if (!afterColon.startsWith('"')) return null;

  let content = "";
  let escaped = false;
  for (let i = 1; i < afterColon.length; i++) {
    const char = afterColon[i];
    if (escaped) {
      if (char === "n") content += "\n";
      else if (char === "t") content += "\t";
      else if (char === "r") content += "\r";
      else content += char;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === '"') {
      break;
    } else {
      content += char;
    }
  }
  return content;
}

/** Get the session storage key for storing conversation ID */
function getSessionStorageKey(projectId: string): string {
  return `ifc-viewer:conversation:${projectId}`;
}

/** Convert API messages to AgentMessage format */
function toAgentMessages(
  messages: ConversationWithMessages["messages"]
): AgentMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: new Date(m.createdAt),
  }));
}

// ============================================================================
// Provider
// ============================================================================

interface AgentProviderProps {
  projectId: string;
  children: ReactNode;
}

export function AgentProvider({
  projectId,
  children,
}: AgentProviderProps) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(() => {
    // Initialize from session storage
    return sessionStorage.getItem(getSessionStorageKey(projectId));
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const presenceCallbacksRef = useRef<Set<(event: AIEvent) => void>>(new Set());
  const currentStepRef = useRef<number>(0);
  const streamingToolsRef = useRef<Map<string, StreamingToolState>>(new Map());

  const apiUrl = import.meta.env.VITE_API_URL || "";

  // ============================================================================
  // SDK Queries & Mutations
  // ============================================================================

  const EMPTY_CONVERSATIONS: Conversation[] = [];

  // Fetch conversations list
  const conversationsQuery = useQuery({
    ...listConversationsOptions({ path: { id: projectId } }),
  });

  const conversations = conversationsQuery.data ?? EMPTY_CONVERSATIONS;

  // Create conversation mutation
  const createConvMutation = useMutation({
    ...createConversationMutation(),
  });

  // Delete conversation mutation
  const deleteConvMutation = useMutation({
    ...deleteConversationMutation(),
  });

  // Stop generation mutation
  const stopMutation = useMutation({
    ...stopGenerationMutation(),
  });

  // Clear messages when no conversation selected
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
    }
  }, [conversationId]);

  // Load conversation messages when conversationId changes (and list is loaded)
  // Skip if we already have messages (active chat session)
  useEffect(() => {
    if (!conversationId) return;
    if (!conversationsQuery.isSuccess) return;

    // Skip verification and fetching if we already have messages
    // This prevents resetting state during an active chat session
    if (messages.length > 0) return;

    // Verify conversation exists in the list
    const list = conversationsQuery.data ?? EMPTY_CONVERSATIONS;
    const exists = list.some((c) => c.id === conversationId);
    if (!exists) {
      setConversationId(null);
      return;
    }

    // Fetch conversation messages
    const fetchMessages = async () => {
      try {
        const data = await queryClient.fetchQuery(
          getConversationOptions({
            path: { id: projectId, conversationId },
          })
        );
        if (data) {
          setMessages(toAgentMessages(data.messages));
        }
      } catch (error) {
        console.error("[Agent] Failed to fetch conversation:", error);
      }
    };

    fetchMessages();
  }, [
    conversationId,
    conversationsQuery.isSuccess,
    conversationsQuery.dataUpdatedAt,
    projectId,
    queryClient,
    messages.length,
  ]);

  // Save conversation ID to session storage when it changes
  useEffect(() => {
    if (conversationId) {
      sessionStorage.setItem(getSessionStorageKey(projectId), conversationId);
    } else {
      sessionStorage.removeItem(getSessionStorageKey(projectId));
    }
  }, [conversationId, projectId]);

  const emitPresenceEvent = useCallback((event: AIEvent) => {
    for (const callback of presenceCallbacksRef.current) {
      callback(event);
    }
  }, []);

  const handleAgentEvent = useCallback(
    (event: AIEvent) => {
      emitPresenceEvent(event);

      switch (event.type) {
        case "step-start":
          currentStepRef.current = event.stepIndex;
          break;

        case "text-delta":
          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            const lastMsg = prev[lastIdx];
            if (lastMsg?.role === "assistant") {
              const currentStep = currentStepRef.current;
              const parts = [...(lastMsg.parts || [])];

              const lastPart = parts[parts.length - 1];
              if (
                lastPart?.type === "text" &&
                lastPart.stepIndex === currentStep
              ) {
                parts[parts.length - 1] = {
                  ...lastPart,
                  content: lastPart.content + event.content,
                };
              } else {
                parts.push({
                  type: "text",
                  content: event.content,
                  stepIndex: currentStep,
                });
              }

              return [
                ...prev.slice(0, lastIdx),
                {
                  ...lastMsg,
                  content: lastMsg.content + event.content,
                  parts,
                },
              ];
            }
            return prev;
          });
          break;

        case "tool-input-start":
          streamingToolsRef.current.set(event.id, {
            id: event.id,
            name: event.name,
            buffer: "",
            lastContentLength: 0,
            lastPath: null,
            currentLine: 0,
            currentColumn: 0,
          });
          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            const lastMsg = prev[lastIdx];
            if (lastMsg?.role === "assistant") {
              const currentStep = currentStepRef.current;
              const toolInvocation: ToolInvocation = {
                id: event.id,
                toolName: event.name,
                args: {},
                state: "streaming" as const,
              };

              const parts: MessagePart[] = [...(lastMsg.parts || [])];
              parts.push({
                type: "tool",
                toolInvocation,
                stepIndex: currentStep,
              });

              return [
                ...prev.slice(0, lastIdx),
                {
                  ...lastMsg,
                  parts,
                  toolInvocations: [
                    ...(lastMsg.toolInvocations || []),
                    toolInvocation,
                  ],
                },
              ];
            }
            return prev;
          });
          break;

        case "tool-input-delta": {
          const toolState = streamingToolsRef.current.get(event.id);
          if (!toolState) break;

          toolState.buffer += event.delta;

          const extractedArgs: Record<string, unknown> = {};

          if (toolState.name === "writeFile") {
            const path = extractStreamingField(toolState.buffer, "path");
            const content = extractStreamingField(toolState.buffer, "content");

            if (path) {
              extractedArgs.path = path;
              if (path !== toolState.lastPath) {
                toolState.lastPath = path;
                emitPresenceEvent({ type: "editor-open", path });
              }
            }

            if (content !== null) {
              extractedArgs.content = content;
              if (content.length > toolState.lastContentLength) {
                const newChunk = content.slice(toolState.lastContentLength);
                toolState.lastContentLength = content.length;

                if (path) {
                  for (const char of newChunk) {
                    if (char === "\n") {
                      toolState.currentLine++;
                      toolState.currentColumn = 0;
                    } else {
                      emitPresenceEvent({
                        type: "editor-insert",
                        path,
                        position: {
                          line: toolState.currentLine,
                          column: toolState.currentColumn,
                        },
                        text: char,
                      });
                      toolState.currentColumn++;
                    }
                  }
                }
              }
            }
          } else if (toolState.name === "executeCommand") {
            const command = extractStreamingField(toolState.buffer, "command");

            if (command !== null) {
              extractedArgs.command = command;
              if (command.length > toolState.lastContentLength) {
                const newChunk = command.slice(toolState.lastContentLength);
                toolState.lastContentLength = command.length;

                emitPresenceEvent({
                  type: "terminal-append",
                  text: newChunk,
                });
              }
            }
          }

          if (Object.keys(extractedArgs).length > 0) {
            setMessages((prev) => {
              const lastIdx = prev.length - 1;
              const lastMsg = prev[lastIdx];
              if (lastMsg?.role === "assistant") {
                const newToolInvocations = lastMsg.toolInvocations?.map((t) =>
                  t.id === event.id
                    ? { ...t, args: { ...t.args, ...extractedArgs } }
                    : t
                );
                const newParts: MessagePart[] = (lastMsg.parts || []).map(
                  (p) => {
                    if (p.type === "tool" && p.toolInvocation.id === event.id) {
                      return {
                        ...p,
                        toolInvocation: {
                          ...p.toolInvocation,
                          args: { ...p.toolInvocation.args, ...extractedArgs },
                        },
                      };
                    }
                    return p;
                  }
                );
                return [
                  ...prev.slice(0, lastIdx),
                  {
                    ...lastMsg,
                    toolInvocations: newToolInvocations,
                    parts: newParts,
                  },
                ];
              }
              return prev;
            });
          }
          break;
        }

        case "tool-input-end":
          streamingToolsRef.current.delete(event.id);
          break;

        case "tool-call":
          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            const lastMsg = prev[lastIdx];
            if (lastMsg?.role === "assistant") {
              const existingToolIndex = lastMsg.toolInvocations?.findIndex(
                (t) => t.id === event.id
              );

              if (existingToolIndex !== undefined && existingToolIndex >= 0) {
                const newToolInvocations = lastMsg.toolInvocations!.map((t) =>
                  t.id === event.id
                    ? { ...t, args: event.args, state: "running" as const }
                    : t
                );

                const newParts: MessagePart[] = (lastMsg.parts || []).map(
                  (p) => {
                    if (p.type === "tool" && p.toolInvocation.id === event.id) {
                      return {
                        ...p,
                        toolInvocation: {
                          ...p.toolInvocation,
                          args: event.args,
                          state: "running" as const,
                        },
                      };
                    }
                    return p;
                  }
                );

                return [
                  ...prev.slice(0, lastIdx),
                  {
                    ...lastMsg,
                    toolInvocations: newToolInvocations,
                    parts: newParts,
                  },
                ];
              } else {
                const currentStep = currentStepRef.current;
                const toolInvocation: ToolInvocation = {
                  id: event.id,
                  toolName: event.name,
                  args: event.args,
                  state: "running" as const,
                };

                const parts: MessagePart[] = [...(lastMsg.parts || [])];
                parts.push({
                  type: "tool",
                  toolInvocation,
                  stepIndex: currentStep,
                });

                return [
                  ...prev.slice(0, lastIdx),
                  {
                    ...lastMsg,
                    parts,
                    toolInvocations: [
                      ...(lastMsg.toolInvocations || []),
                      toolInvocation,
                    ],
                  },
                ];
              }
            }
            return prev;
          });
          break;

        case "tool-result":
          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            const lastMsg = prev[lastIdx];
            if (lastMsg?.role === "assistant" && lastMsg.toolInvocations) {
              const newToolInvocations = lastMsg.toolInvocations.map((t) =>
                t.id === event.id
                  ? { ...t, result: event.result, state: "completed" as const }
                  : t
              );

              const newParts: MessagePart[] = (lastMsg.parts || []).map((p) => {
                if (p.type === "tool" && p.toolInvocation.id === event.id) {
                  return {
                    ...p,
                    toolInvocation: {
                      ...p.toolInvocation,
                      result: event.result,
                      state: "completed" as const,
                    },
                  };
                }
                return p;
              });

              return [
                ...prev.slice(0, lastIdx),
                {
                  ...lastMsg,
                  toolInvocations: newToolInvocations,
                  parts: newParts,
                },
              ];
            }
            return prev;
          });
          break;

        case "finish":
          setIsLoading(false);
          currentStepRef.current = 0;
          streamingToolsRef.current.clear();
          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            const lastMsg = prev[lastIdx];
            if (lastMsg?.role === "assistant" && lastMsg.toolInvocations) {
              const newToolInvocations = lastMsg.toolInvocations.map((t) =>
                t.state === "running" ||
                t.state === "pending" ||
                t.state === "streaming"
                  ? { ...t, state: "completed" as const }
                  : t
              );

              const newParts: MessagePart[] = (lastMsg.parts || []).map((p) => {
                if (
                  p.type === "tool" &&
                  (p.toolInvocation.state === "running" ||
                    p.toolInvocation.state === "pending" ||
                    p.toolInvocation.state === "streaming")
                ) {
                  return {
                    ...p,
                    toolInvocation: {
                      ...p.toolInvocation,
                      state: "completed" as const,
                    },
                  };
                }
                return p;
              });

              return [
                ...prev.slice(0, lastIdx),
                {
                  ...lastMsg,
                  toolInvocations: newToolInvocations,
                  parts: newParts,
                },
              ];
            }
            return prev;
          });
          break;

        case "error":
          setIsLoading(false);
          currentStepRef.current = 0;
          streamingToolsRef.current.clear();
          console.error("[Agent] Error:", event.message);
          break;
      }
    },
    [emitPresenceEvent]
  );

  // ============================================================================
  // Conversation Management
  // ============================================================================

  const selectConversation = useCallback(async (convId: string) => {
    setConversationId(convId);
    setMessages([]);
    // Messages will be fetched by the useEffect above
  }, []);

  const deselectConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
  }, []);

  const createNewConversation = useCallback(async () => {
    try {
      const result = await createConvMutation.mutateAsync({
        path: { id: projectId },
        body: {},
      });
      if (result) {
        setConversationId(result.id);
        setMessages([]);
      }
    } catch (error) {
      console.error("[Agent] Failed to create conversation:", error);
    }
  }, [createConvMutation, projectId]);

  const deleteConversationHandler = useCallback(
    async (convId: string) => {
      try {
        await deleteConvMutation.mutateAsync({
          path: { id: projectId, conversationId: convId },
        });
        // Invalidate conversations list to update UI
        queryClient.invalidateQueries({
          queryKey: listConversationsQueryKey({ path: { id: projectId } }),
        });
        // If deleting active conversation, clear state
        if (convId === conversationId) {
          setConversationId(null);
          setMessages([]);
        }
      } catch (error) {
        console.error("[Agent] Failed to delete conversation:", error);
      }
    },
    [deleteConvMutation, projectId, conversationId, queryClient]
  );

  // ============================================================================
  // Chat
  // ============================================================================

  const sendMessage = useCallback(
    async (content: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Create conversation if needed
      let activeConvId = conversationId;
      if (!activeConvId) {
        try {
          const conv = await createConvMutation.mutateAsync({
            path: { id: projectId },
            body: {},
          });
          if (!conv) {
            console.error("[Agent] Failed to create conversation");
            return;
          }
          activeConvId = conv.id;
          setConversationId(activeConvId);
          // Invalidate conversations list so new conversation appears in list
          queryClient.invalidateQueries({
            queryKey: listConversationsQueryKey({ path: { id: projectId } }),
          });
        } catch (error) {
          console.error("[Agent] Failed to create conversation:", error);
          return;
        }
      }

      const userMessage: AgentMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content,
        createdAt: new Date(),
      };

      const assistantMessage: AgentMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: "",
        toolInvocations: [],
        parts: [],
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      fetchSSE<AIEvent>({
        url: `${apiUrl}/api/projects/${projectId}/conversations/${activeConvId}/chat`,
        body: {
          content,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
        onEvent: handleAgentEvent,
        onComplete: () => {
          setIsLoading(false);
          abortControllerRef.current = null;
          // Refresh conversations to update the title (auto-generated from first message)
          queryClient.invalidateQueries({
            queryKey: listConversationsQueryKey({ path: { id: projectId } }),
          });
        },
        onError: (err: Error) => {
          console.error("[Agent] SSE error:", err);
          setIsLoading(false);
          abortControllerRef.current = null;
        },
        signal: abortController.signal,
        eventName: "message",
      });
    },
    [
      apiUrl,
      projectId,
      conversationId,
      messages,
      createConvMutation,
      handleAgentEvent,
      queryClient,
    ]
  );

  const stop = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (conversationId) {
      try {
        await stopMutation.mutateAsync({
          path: { id: projectId, conversationId },
        });
      } catch (error) {
        // 404 is expected if there's no active generation
        if (!(error instanceof Error && error.message.includes("404"))) {
          console.error("[Agent] Failed to stop:", error);
        }
      }
    }

    setIsLoading(false);
    streamingToolsRef.current.clear();
  }, [stopMutation, projectId, conversationId]);

  const clearMessages = useCallback(async () => {
    if (conversationId) {
      try {
        await deleteConvMutation.mutateAsync({
          path: { id: projectId, conversationId },
        });
        // Invalidate conversations list to update UI
        queryClient.invalidateQueries({
          queryKey: listConversationsQueryKey({ path: { id: projectId } }),
        });
      } catch (error) {
        console.error("[Agent] Failed to delete conversation:", error);
      }
    }
    setConversationId(null);
    setMessages([]);
  }, [deleteConvMutation, projectId, conversationId, queryClient]);

  const onPresenceEvent = useCallback((callback: (event: AIEvent) => void) => {
    presenceCallbacksRef.current.add(callback);
    return () => {
      presenceCallbacksRef.current.delete(callback);
    };
  }, []);

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
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgent must be used within an AgentProvider");
  }
  return context;
}
