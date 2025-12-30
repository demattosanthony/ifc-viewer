import { Elysia, t } from "elysia";
import { createAgent, type AgentEvent } from "@ifc-viewer/agent";
import { createSSEStream, sseResponse } from "@ifc-viewer/realtime";
import type { AppContext } from "../context";

/**
 * Agent chat routes with SSE streaming
 */
export function agentRoutes(ctx: AppContext) {
  // Track active conversations for abort handling
  const activeConversations = new Map<
    string,
    {
      abortController: AbortController;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    }
  >();

  return new Elysia({ prefix: "/api/sessions/:id/agent" })
    .post(
      "/chat",
      async ({ params, body, set }) => {
        const sandbox = ctx.getSandbox(params.id);
        if (!sandbox) {
          set.status = 404;
          return { error: "Session not found" };
        }

        // Create or get conversation state
        let conversation = activeConversations.get(params.id);
        if (!conversation) {
          conversation = {
            abortController: new AbortController(),
            messages: [],
          };
          activeConversations.set(params.id, conversation);
        }

        // Cancel any existing generation
        if (conversation.abortController) {
          conversation.abortController.abort();
        }
        conversation.abortController = new AbortController();

        // Add user message to history
        if (body.history) {
          conversation.messages = body.history.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
        }
        conversation.messages.push({ role: "user", content: body.content });

        // Create the agent
        const agent = createAgent({
          computer: sandbox.computer,
          getTerminal: () => sandbox.getOrCreateAgentTerminal(),
        });

        // Capture conversation reference for closure
        const currentConversation = conversation;

        // Stream the response using SSE
        const stream = createSSEStream(async (sseCtx) => {
          // Send ready event
          sseCtx.send("message", { type: "ready" });

          let assistantMessage = "";

          try {
            const emit = (event: AgentEvent) => {
              if (sseCtx.isOpen) {
                sseCtx.send("message", event);
              }
            };

            for await (const event of agent.streamChat(
              currentConversation.messages,
              emit,
              currentConversation.abortController.signal
            )) {
              if (event.type === "text-delta") {
                assistantMessage += event.content;
              }
            }

            // Add assistant message to history
            if (assistantMessage) {
              currentConversation.messages.push({
                role: "assistant",
                content: assistantMessage,
              });
            }
          } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
              sseCtx.send("message", {
                type: "error",
                message: err.message,
              });
            }
            // Always emit finish event so client can reset loading state
            sseCtx.send("message", {
              type: "finish",
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            });
          } finally {
            sseCtx.close();
          }
        });

        return sseResponse(stream);
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          content: t.String(),
          history: t.Optional(
            t.Array(
              t.Object({
                role: t.String(),
                content: t.String(),
              })
            )
          ),
        }),
        detail: {
          summary: "Start agent chat with SSE streaming",
          tags: ["Agent"],
        },
      }
    )
    .post(
      "/stop",
      async ({ params, set }) => {
        const conversation = activeConversations.get(params.id);
        if (!conversation) {
          set.status = 404;
          return { error: "No active conversation" };
        }

        conversation.abortController.abort();
        return { success: true };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: "Stop ongoing agent generation",
          tags: ["Agent"],
        },
      }
    )
    .delete(
      "/history",
      async ({ params }) => {
        activeConversations.delete(params.id);
        return { success: true };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: "Clear conversation history",
          tags: ["Agent"],
        },
      }
    );
}
