import { sessionManager } from "@/shared/utils/session-manager";
import {
  createAgent,
  type AgentEvent,
  type ClientMessage,
} from "@ifc-viewer/agent";
import type { ServerWebSocket, WebSocketContext } from "@ademattos/bunbox";

// Simple message type matching ModelMessage from AI SDK
interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface CustomData {
  sessionId: string;
  messages: Message[];
  abortController?: AbortController;
}

interface BunboxWsData {
  data: CustomData;
}

function getCustomData(ws: ServerWebSocket): CustomData {
  return (ws.data as BunboxWsData).data;
}

export function upgrade(req: Request): boolean | { data?: unknown } {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) return false;
  return { data: { sessionId, messages: [] } };
}

export async function onOpen(ws: ServerWebSocket, _ctx: WebSocketContext) {
  try {
    const customData = getCustomData(ws);
    const { sessionId } = customData;

    if (!sessionId) {
      ws.close(1008, "Session ID is required");
      return;
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      ws.close(1008, "Session not found");
      return;
    }

    // Send ready event
    ws.send(JSON.stringify({ type: "ready" }));
  } catch (error) {
    console.error("[WS Agent] Error in onOpen:", error);
    ws.close(1011, "Internal error");
  }
}

export async function onMessage(
  ws: ServerWebSocket,
  message: string,
  _ctx: WebSocketContext
) {
  const customData = getCustomData(ws);
  const { sessionId } = customData;

  if (!sessionId) {
    ws.close(1008, "Session ID is required");
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    ws.close(1008, "Session not found");
    return;
  }

  try {
    const parsed: ClientMessage = JSON.parse(message);

    if (parsed.type === "chat") {
      // Cancel any existing generation
      if (customData.abortController) {
        customData.abortController.abort();
      }

      // Create new abort controller
      customData.abortController = new AbortController();

      // Add user message to history
      customData.messages.push({ role: "user", content: parsed.content });

      // Include any history from the client
      if (parsed.history) {
        customData.messages = [
          ...parsed.history.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user" as const, content: parsed.content },
        ];
      }

      // Create agent with the session's computer and terminal getter
      const agent = createAgent({
        computer: session.computer,
        getTerminal: () => sessionManager.getAgentTerminal(sessionId),
      });

      // Emit function to send events via WebSocket
      const emit = (event: AgentEvent) => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify(event));
        }
      };

      // Stream the response
      let assistantMessage = "";
      try {
        for await (const event of agent.streamChat(
          customData.messages,
          emit,
          customData.abortController.signal
        )) {
          if (event.type === "text-delta") {
            assistantMessage += event.content;
          }
        }

        // Add assistant message to history
        if (assistantMessage) {
          customData.messages.push({
            role: "assistant",
            content: assistantMessage,
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          emit({
            type: "error",
            message: error.message,
          });
        }
        // Always emit finish event so client can reset loading state
        emit({
          type: "finish",
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        });
      } finally {
        customData.abortController = undefined;
      }
    } else if (parsed.type === "stop") {
      // Cancel ongoing generation
      if (customData.abortController) {
        customData.abortController.abort();
        customData.abortController = undefined;
      }
    } else if (parsed.type === "approve-tool") {
      // TODO: Implement tool approval when AI SDK v6 is stable
      console.log("[WS Agent] Tool approval:", parsed.toolCallId);
    } else if (parsed.type === "reject-tool") {
      // TODO: Implement tool rejection when AI SDK v6 is stable
      console.log("[WS Agent] Tool rejection:", parsed.toolCallId);
    }
  } catch (error) {
    console.error("[WS Agent] Error processing message:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message:
          error instanceof Error ? error.message : "Invalid message format",
      })
    );
  }
}

export function onClose(
  ws: ServerWebSocket,
  _code: number,
  _reason: string,
  _ctx: WebSocketContext
) {
  const customData = getCustomData(ws);

  // Cancel any ongoing generation
  if (customData.abortController) {
    customData.abortController.abort();
  }

  console.log(
    "[WS Agent] Connection closed for session:",
    customData.sessionId
  );
}
