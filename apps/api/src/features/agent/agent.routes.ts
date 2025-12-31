import { Elysia, t } from "elysia";
import { createAgent, type AgentEvent } from "@ifc-viewer/agent";
import { createSSEStream, sseResponse } from "@ifc-viewer/realtime";
import type { AppContext } from "../../context";
import { ErrorResponse, SuccessResponse } from "../../schemas";
import { ConversationWithMessagesResponse } from "./agent.schemas";

const abortControllers = new Map<string, AbortController>();

export function agentRoutes(ctx: AppContext) {
  return new Elysia({ prefix: "/api/workspaces/:id/agent" })
    .post(
      "/chat",
      async ({ params, body }) => {
        const computer = ctx.getComputer(params.id);

        // Get or create conversation for workspace
        let conversation = await ctx.db.conversations.findActiveByWorkspaceId(
          params.id
        );
        if (!conversation) {
          conversation = await ctx.db.conversations.create({
            workspaceId: params.id,
          });
        }

        const existingController = abortControllers.get(params.id);
        if (existingController) {
          existingController.abort();
        }

        const abortController = new AbortController();
        abortControllers.set(params.id, abortController);

        // Get message history
        let messageHistory: Array<{
          role: "user" | "assistant";
          content: string;
        }>;

        if (body.history && body.history.length > 0) {
          messageHistory = body.history.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
        } else {
          // Fetch messages from DB
          const messages = await ctx.db.messages.findByConversationId(
            conversation.id
          );
          messageHistory = messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
        }

        messageHistory.push({ role: "user", content: body.content });

        // Save user message
        await ctx.db.messages.create({
          conversationId: conversation.id,
          role: "user",
          content: body.content,
        });

        await ctx.db.conversations.update(conversation.id, {
          status: "streaming",
        });

        const agent = createAgent({
          computer,
          getTerminal: () => computer.getOrCreateAgentTerminal(),
        });

        const conversationId = conversation.id;

        const stream = createSSEStream(async (sseCtx) => {
          sseCtx.send("message", { type: "ready" });

          let assistantMessage = "";

          try {
            const emit = (event: AgentEvent) => {
              if (sseCtx.isOpen) {
                sseCtx.send("message", event);
              }
            };

            for await (const event of agent.streamChat(
              messageHistory,
              emit,
              abortController.signal
            )) {
              if (event.type === "text-delta") {
                assistantMessage += event.content;
              }
            }

            if (assistantMessage) {
              await ctx.db.messages.create({
                conversationId,
                role: "assistant",
                content: assistantMessage,
              });
            }

            await ctx.db.conversations.update(conversationId, {
              status: "active",
            });
          } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
              sseCtx.send("message", {
                type: "error",
                message: err.message,
              });
            } else if (err instanceof Error && err.name === "AbortError") {
              await ctx.db.conversations.update(conversationId, {
                status: "aborted",
              });
            }
            sseCtx.send("message", {
              type: "finish",
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            });
          } finally {
            abortControllers.delete(params.id);
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
        const abortController = abortControllers.get(params.id);
        if (!abortController) {
          set.status = 404;
          return { error: "No active generation" };
        }

        abortController.abort();
        return { success: true };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: SuccessResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Stop ongoing agent generation",
          tags: ["Agent"],
        },
      }
    )
    .get(
      "/conversation",
      async ({ params, set }) => {
        const conversation = await ctx.db.conversations.findActiveByWorkspaceId(
          params.id
        );
        if (!conversation) {
          set.status = 404;
          return { error: "No conversation found" };
        }

        // Include messages
        const messages = await ctx.db.messages.findByConversationId(
          conversation.id
        );

        return {
          ...conversation,
          messages,
        };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: ConversationWithMessagesResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Get conversation for workspace",
          tags: ["Agent"],
        },
      }
    )
    .delete(
      "/history",
      async ({ params }) => {
        await ctx.db.conversations.deleteByWorkspaceId(params.id);
        return { success: true };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: SuccessResponse,
        },
        detail: {
          summary: "Clear conversation history",
          tags: ["Agent"],
        },
      }
    );
}
