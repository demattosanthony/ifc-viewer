"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { fetchSSE } from "@ifc-viewer/realtime";
import type { AgentEvent } from "@ifc-viewer/realtime";
import type {
  AgentMessage,
  ToolInvocation,
  MessagePart,
} from "@ifc-viewer/core";

interface StreamingToolState {
  id: string;
  name: string;
  buffer: string;
  lastContentLength: number;
  lastPath: string | null;
  currentLine: number;
  currentColumn: number;
}

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

interface AgentContextValue {
  messages: AgentMessage[];
  isLoading: boolean;
  sendMessage: (content: string) => void;
  stop: () => void;
  clearMessages: () => void;
  onPresenceEvent: (callback: (event: AgentEvent) => void) => () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

interface AgentProviderProps {
  workspaceId: string;
  children: ReactNode;
}

export function AgentProvider({ workspaceId, children }: AgentProviderProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const presenceCallbacksRef = useRef<Set<(event: AgentEvent) => void>>(
    new Set()
  );
  const currentStepRef = useRef<number>(0);
  const streamingToolsRef = useRef<Map<string, StreamingToolState>>(new Map());

  const emitPresenceEvent = useCallback((event: AgentEvent) => {
    for (const callback of presenceCallbacksRef.current) {
      callback(event);
    }
  }, []);

  const handleAgentEvent = useCallback(
    (event: AgentEvent) => {
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

  const sendMessage = useCallback(
    (content: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

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

      fetchSSE<AgentEvent>({
        url: `${
          import.meta.env.VITE_API_URL
        }/api/workspaces/${workspaceId}/agent/chat`,
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
    [workspaceId, messages, handleAgentEvent]
  );

  const stop = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    try {
      await fetch(`/api/workspaces/${workspaceId}/agent/stop`, {
        method: "POST",
      });
    } catch (error) {
      console.error("[Agent] Failed to stop:", error);
    }

    setIsLoading(false);
    streamingToolsRef.current.clear();
  }, [workspaceId]);

  const clearMessages = useCallback(async () => {
    setMessages([]);

    try {
      await fetch(`/api/workspaces/${workspaceId}/agent/history`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("[Agent] Failed to clear history:", error);
    }
  }, [workspaceId]);

  const onPresenceEvent = useCallback(
    (callback: (event: AgentEvent) => void) => {
      presenceCallbacksRef.current.add(callback);
      return () => {
        presenceCallbacksRef.current.delete(callback);
      };
    },
    []
  );

  return (
    <AgentContext.Provider
      value={{
        messages,
        isLoading,
        sendMessage,
        stop,
        clearMessages,
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
