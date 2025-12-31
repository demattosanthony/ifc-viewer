import { Elysia, t } from "elysia";
import { createAgent, type AgentEvent } from "@ifc-viewer/agent";
import { createSSEStream, sseResponse } from "@ifc-viewer/realtime";
import { isDomainError } from "@ifc-viewer/core";
import type { AppContext } from "../context";

const abortControllers = new Map<string, AbortController>();

export function agentRoutes(ctx: AppContext) {
  return new Elysia({ prefix: "/api/sessions/:id/agent" })
    .post(
      "/chat",
      async ({ params, body, set }) => {
        const computer = ctx.getComputer(params.id);

        let conversation = await ctx.client.conversations.getBySessionId(
          params.id
        );
        if (!conversation) {
          conversation = await ctx.client.conversations.start(params.id);
        }

        const existingController = abortControllers.get(params.id);
        if (existingController) {
          existingController.abort();
        }

        const abortController = new AbortController();
        abortControllers.set(params.id, abortController);

        let messageHistory: Array<{ role: "user" | "assistant"; content: string }>;

        if (body.history && body.history.length > 0) {
          messageHistory = body.history.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
        } else {
          messageHistory = conversation.messages.map((m) => ({
            role: m.role,
            content: m.content,
          }));
        }

        messageHistory.push({ role: "user", content: body.content });

        await ctx.client.conversations.addMessage(
          conversation.id,
          "user",
          body.content
        );

        await ctx.client.conversations.updateStatus(conversation.id, "streaming");

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
              await ctx.client.conversations.addMessage(
                conversationId,
                "assistant",
                assistantMessage
              );
            }

            await ctx.client.conversations.updateStatus(conversationId, "active");
          } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
              sseCtx.send("message", {
                type: "error",
                message: err.message,
              });
            } else if (err instanceof Error && err.name === "AbortError") {
              await ctx.client.conversations.updateStatus(
                conversationId,
                "aborted"
              );
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
        detail: {
          summary: "Stop ongoing agent generation",
          tags: ["Agent"],
        },
      }
    )
    .get(
      "/conversation",
      async ({ params, set }) => {
        const conversation = await ctx.client.conversations.getBySessionId(
          params.id
        );
        if (!conversation) {
          set.status = 404;
          return { error: "No conversation found" };
        }
        return conversation;
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: "Get conversation for session",
          tags: ["Agent"],
        },
      }
    )
    .delete(
      "/history",
      async ({ params, set }) => {
        try {
          await ctx.client.conversations.deleteBySessionId(params.id);
          return { success: true };
        } catch (error) {
          if (isDomainError(error)) {
            set.status = error.statusCode;
            return error.toJSON();
          }
          throw error;
        }
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
