/**
 * Conversation Routes
 *
 * Handles conversation CRUD and chat streaming for projects.
 *
 * Routes:
 *   POST   /api/projects/:id/conversations                    - Create conversation
 *   GET    /api/projects/:id/conversations                    - List conversations
 *   GET    /api/projects/:id/conversations/:conversationId    - Get conversation with messages
 *   DELETE /api/projects/:id/conversations/:conversationId    - Delete conversation
 *   DELETE /api/projects/:id/conversations                    - Clear all conversations
 *   POST   /api/projects/:id/conversations/:conversationId/chat - Chat (SSE)
 *   POST   /api/projects/:id/conversations/:conversationId/stop - Stop generation
 */

import { Elysia } from "elysia"
import { runAgentChat, type Context, type AIEvent } from "@ifc-viewer/core"
import { createSSEStream, sseResponse } from "@ifc-viewer/realtime"
import {
  ConversationController,
  CreateConversationRequest,
  StartChatRequest,
  ConversationResponse,
  ConversationListResponse,
  ConversationWithMessagesResponse,
  ErrorResponse,
  SuccessResponse,
} from "@ifc-viewer/interface"
import { z } from "zod"

// Track abort controllers by conversationId
const abortControllers = new Map<string, AbortController>()

export function conversationRoutes(ctx: Context) {
  const controller = new ConversationController(ctx)

  // Note: Using :id to match the existing projects routes parameter name
  return new Elysia({ prefix: "/api/projects/:id/conversations" })
    // Create a new conversation
    .post(
      "/",
      async ({ params, body, set }) => {
        const result = await controller.create(params.id, body.title)
        if (!result.success) {
          set.status = result.status
          return { error: result.error }
        }
        return result.data
      },
      {
        params: z.object({
          id: z.string(),
        }),
        body: CreateConversationRequest,
        response: {
          200: ConversationResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Create a new conversation",
          tags: ["Conversations"],
        },
      }
    )
    // List all conversations for a project
    .get(
      "/",
      async ({ params, set }) => {
        // Verify project exists first
        const project = await ctx.db.projects.findById(params.id)
        if (!project) {
          set.status = 404
          return { error: `Project ${params.id} not found` }
        }
        const result = await controller.listByProject(params.id)
        if (!result.success) {
          set.status = result.status
          return { error: result.error }
        }
        return result.data
      },
      {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: ConversationListResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "List conversations for project",
          tags: ["Conversations"],
        },
      }
    )
    // Get a specific conversation with messages
    .get(
      "/:conversationId",
      async ({ params, set }) => {
        const result = await controller.getById(params.conversationId)
        if (!result.success) {
          set.status = result.status
          return { error: result.error }
        }
        return result.data
      },
      {
        params: z.object({
          id: z.string(),
          conversationId: z.string().uuid(),
        }),
        response: {
          200: ConversationWithMessagesResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Get conversation with messages",
          tags: ["Conversations"],
        },
      }
    )
    // Delete a specific conversation
    .delete(
      "/:conversationId",
      async ({ params }) => {
        const result = await controller.delete(params.conversationId)
        if (!result.success) {
          return { success: false }
        }
        return result.data
      },
      {
        params: z.object({
          id: z.string(),
          conversationId: z.string().uuid(),
        }),
        response: {
          200: SuccessResponse,
        },
        detail: {
          summary: "Delete conversation",
          tags: ["Conversations"],
        },
      }
    )
    // Clear all conversations for a project
    .delete(
      "/",
      async ({ params }) => {
        const result = await controller.clearProject(params.id)
        if (!result.success) {
          return { success: false }
        }
        return result.data
      },
      {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: SuccessResponse,
        },
        detail: {
          summary: "Clear all conversations for project",
          tags: ["Conversations"],
        },
      }
    )
    // Chat within a conversation (SSE streaming)
    .post(
      "/:conversationId/chat",
      async ({ params, body }) => {
        const { id: projectId, conversationId } = params
        const { workspaceId, content, history } = body

        // Cancel any existing generation for this conversation
        const existingController = abortControllers.get(conversationId)
        if (existingController) {
          existingController.abort()
        }

        const abortController = new AbortController()
        abortControllers.set(conversationId, abortController)

        const stream = createSSEStream(async (sseCtx) => {
          sseCtx.send("message", { type: "ready" })

          try {
            for await (const event of runAgentChat(ctx, {
              projectId,
              conversationId,
              workspaceId,
              content,
              history: history?.map((m) => ({
                role: m.role,
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
            abortControllers.delete(conversationId)
            sseCtx.close()
          }
        })

        return sseResponse(stream)
      },
      {
        params: z.object({
          id: z.string(),
          conversationId: z.string().uuid(),
        }),
        body: StartChatRequest,
        detail: {
          summary: "Chat within conversation (SSE streaming)",
          tags: ["Conversations"],
        },
      }
    )
    // Stop ongoing generation for a conversation
    .post(
      "/:conversationId/stop",
      async ({ params, set }) => {
        const abortController = abortControllers.get(params.conversationId)
        if (!abortController) {
          set.status = 404
          return { error: "No active generation" }
        }

        abortController.abort()
        return { success: true }
      },
      {
        params: z.object({
          id: z.string(),
          conversationId: z.string().uuid(),
        }),
        response: {
          200: SuccessResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Stop ongoing chat generation",
          tags: ["Conversations"],
        },
      }
    )
}
