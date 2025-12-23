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
import type { AgentEvent, AgentMessage, ToolInvocation, MessagePart, TextPart, ToolPart } from "@ifc-viewer/agent";

interface AgentContextValue {
  messages: AgentMessage[];
  isConnected: boolean;
  isLoading: boolean;
  sendMessage: (content: string) => void;
  stop: () => void;
  clearMessages: () => void;
  // Presence events for UI integration
  onPresenceEvent: (callback: (event: AgentEvent) => void) => () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

interface AgentProviderProps {
  sessionId: string;
  children: ReactNode;
}

export function AgentProvider({ sessionId, children }: AgentProviderProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const presenceCallbacksRef = useRef<Set<(event: AgentEvent) => void>>(
    new Set()
  );
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  // Track current step for building message parts
  const currentStepRef = useRef<number>(0);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/agent?sessionId=${sessionId}`
    );

    ws.onopen = () => {
      setIsConnected(true);
      console.log("[Agent] WebSocket connected");
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsLoading(false);
      console.log("[Agent] WebSocket disconnected");

      // Reconnect after 2 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 2000);
    };

    ws.onerror = (error) => {
      console.error("[Agent] WebSocket error:", error);
    };

    ws.onmessage = (event) => {
      try {
        const data: AgentEvent = JSON.parse(event.data);
        handleAgentEvent(data);
      } catch (error) {
        console.error("[Agent] Failed to parse message:", error);
      }
    };

    wsRef.current = ws;
  }, [sessionId]);

  // Handle agent events
  const handleAgentEvent = useCallback((event: AgentEvent) => {
    // Notify presence callbacks
    for (const callback of presenceCallbacksRef.current) {
      callback(event);
    }

    switch (event.type) {
      case "start-step":
        currentStepRef.current = event.stepIndex;
        break;

      case "finish-step":
        // Step finished - no action needed, start-step will update the ref
        break;

      case "text-delta":
        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          const lastMsg = prev[lastIdx];
          if (lastMsg?.role === "assistant") {
            const currentStep = currentStepRef.current;
            const parts = [...(lastMsg.parts || [])];

            // Find existing text part for current step, or create one
            const lastPart = parts[parts.length - 1];
            if (lastPart?.type === "text" && lastPart.stepIndex === currentStep) {
              // Append to existing text part
              parts[parts.length - 1] = {
                ...lastPart,
                content: lastPart.content + event.content,
              };
            } else {
              // Create new text part for this step
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
        // Create tool invocation in "pending" state when input streaming starts
        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          const lastMsg = prev[lastIdx];
          if (lastMsg?.role === "assistant") {
            const currentStep = currentStepRef.current;
            const toolInvocation: ToolInvocation = {
              id: event.id,
              toolName: event.name,
              args: {},
              state: "pending" as const,
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

      case "tool-input-delta":
        // Streaming tool input - could accumulate args here if needed
        break;

      case "tool-input-end":
        // Tool input streaming complete - will be followed by tool-call with full args
        break;

      case "tool-call":
        // Update tool invocation with full args and set to running
        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          const lastMsg = prev[lastIdx];
          if (lastMsg?.role === "assistant") {
            // Check if tool already exists (from tool-input-start)
            const existingToolIndex = lastMsg.toolInvocations?.findIndex(t => t.id === event.id);

            if (existingToolIndex !== undefined && existingToolIndex >= 0) {
              // Update existing tool with args and set to running
              const newToolInvocations = lastMsg.toolInvocations!.map((t) =>
                t.id === event.id
                  ? { ...t, args: event.args, state: "running" as const }
                  : t
              );

              const newParts: MessagePart[] = (lastMsg.parts || []).map((p) => {
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
              });

              return [
                ...prev.slice(0, lastIdx),
                { ...lastMsg, toolInvocations: newToolInvocations, parts: newParts },
              ];
            } else {
              // Tool didn't have input streaming, create it now
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
            // Update tool invocations
            const newToolInvocations = lastMsg.toolInvocations.map((t) =>
              t.id === event.id
                ? { ...t, result: event.result, state: "completed" as const }
                : t
            );

            // Update parts array too
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
              { ...lastMsg, toolInvocations: newToolInvocations, parts: newParts },
            ];
          }
          return prev;
        });
        break;

      case "finish":
        setIsLoading(false);
        currentStepRef.current = 0; // Reset for next conversation
        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          const lastMsg = prev[lastIdx];
          if (lastMsg?.role === "assistant" && lastMsg.toolInvocations) {
            // Mark all pending tool invocations as completed
            const newToolInvocations = lastMsg.toolInvocations.map((t) =>
              t.state === "running" || t.state === "pending"
                ? { ...t, state: "completed" as const }
                : t
            );

            // Update parts too
            const newParts: MessagePart[] = (lastMsg.parts || []).map((p) => {
              if (p.type === "tool" && (p.toolInvocation.state === "running" || p.toolInvocation.state === "pending")) {
                return {
                  ...p,
                  toolInvocation: { ...p.toolInvocation, state: "completed" as const },
                };
              }
              return p;
            });

            return [
              ...prev.slice(0, lastIdx),
              { ...lastMsg, toolInvocations: newToolInvocations, parts: newParts },
            ];
          }
          return prev;
        });
        break;

      case "error":
        setIsLoading(false);
        currentStepRef.current = 0;
        console.error("[Agent] Error:", event.message);
        break;
    }
  }, []);

  // Send message
  const sendMessage = useCallback(
    (content: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error("[Agent] WebSocket not connected");
        return;
      }

      // Add user message
      const userMessage: AgentMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Add placeholder assistant message
      const assistantMessage: AgentMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: "",
        toolInvocations: [],
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      setIsLoading(true);

      // Send to WebSocket
      wsRef.current.send(
        JSON.stringify({
          type: "chat",
          content,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        })
      );
    },
    [messages]
  );

  // Stop generation
  const stop = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
      setIsLoading(false);
    }
  }, []);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Subscribe to presence events
  const onPresenceEvent = useCallback(
    (callback: (event: AgentEvent) => void) => {
      presenceCallbacksRef.current.add(callback);
      return () => {
        presenceCallbacksRef.current.delete(callback);
      };
    },
    []
  );

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return (
    <AgentContext.Provider
      value={{
        messages,
        isConnected,
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
