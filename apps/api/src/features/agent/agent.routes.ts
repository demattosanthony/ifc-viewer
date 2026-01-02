import { Elysia, t } from "elysia"
import {
  runAgentChat,
  getConversation,
  clearConversation,
  type Context,
  type AIEvent,
} from "@ifc-viewer/core"
import { createSSEStream, sseResponse } from "@ifc-viewer/realtime"
import { ErrorResponse, SuccessResponse } from "../../schemas"
import { ConversationWithMessagesResponse } from "./agent.schemas"

const abortControllers = new Map<string, AbortController>()

export function agentRoutes(ctx: Context) {
  return new Elysia({ prefix: "/api/workspaces/:id/agent" })
    .post(
      "/chat",
      async ({ params, body }) => {
        // Cancel any existing generation for this workspace
        const existingController = abortControllers.get(params.id)
        if (existingController) {
          existingController.abort()
        }

        const abortController = new AbortController()
        abortControllers.set(params.id, abortController)

        const stream = createSSEStream(async (sseCtx) => {
          sseCtx.send("message", { type: "ready" })

          try {
            // The service handles everything: conversation, messages, persistence
            for await (const event of runAgentChat(ctx, {
              workspaceId: params.id,
              content: body.content,
              history: body.history?.map((m) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
              })),
              signal: abortController.signal,
            })) {
              if (sseCtx.isOpen) {
                sseCtx.send("message", event)
              }
            }
          } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
              sseCtx.send("message", {
                type: "error",
                message: err.message,
              } satisfies AIEvent)
            }
            // Send finish event on error
            sseCtx.send("message", {
              type: "finish",
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            } satisfies AIEvent)
          } finally {
            abortControllers.delete(params.id)
            sseCtx.close()
          }
        })

        return sseResponse(stream)
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
        const abortController = abortControllers.get(params.id)
        if (!abortController) {
          set.status = 404
          return { error: "No active generation" }
        }

        abortController.abort()
        return { success: true }
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
        const conversation = await getConversation(ctx, params.id)
        if (!conversation) {
          set.status = 404
          return { error: "No conversation found" }
        }

        return conversation
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
        await clearConversation(ctx, params.id)
        return { success: true }
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
    )
}
