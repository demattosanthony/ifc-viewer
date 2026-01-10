/**
 * Conversation Routes
 *
 * Routes:
 *   POST   /api/projects/:id/conversations                              - Create conversation
 *   GET    /api/projects/:id/conversations                              - List conversations
 *   GET    /api/projects/:id/conversations/:conversationId              - Get conversation (includes isGenerating)
 *   DELETE /api/projects/:id/conversations/:conversationId              - Delete conversation
 *   DELETE /api/projects/:id/conversations                              - Clear all conversations
 *   POST   /api/projects/:id/conversations/:conversationId/messages     - Send message (starts generation)
 *   GET    /api/projects/:id/conversations/:conversationId/events       - SSE stream for generation events
 *   POST   /api/projects/:id/conversations/:conversationId/stop         - Stop generation
 */

import { type AIEvent, type Context, runAgentChat } from "@ifc-viewer/core"
import {
  ConversationController,
  ConversationListResponse,
  ConversationResponse,
  ConversationWithMessagesResponse,
  CreateConversationRequest,
  createSSEStream,
  ErrorResponse,
  SendMessageRequest,
  SendMessageResponse,
  SuccessResponse,
  sseResponse,
} from "@ifc-viewer/interface"
import { Elysia } from "elysia"
import { z } from "zod"

// Track abort controllers by conversationId
const abortControllers = new Map<string, AbortController>()

export function conversationRoutes(ctx: Context) {
  const controller = new ConversationController(ctx)

  return (
    new Elysia({ prefix: "/api/projects/:id/conversations" })
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
          params: z.object({ id: z.string() }),
          body: CreateConversationRequest,
          response: { 200: ConversationResponse, 404: ErrorResponse },
          detail: {
            summary: "Create a new conversation",
            tags: ["Conversations"],
            operationId: "createConversation",
          },
        }
      )
      // List all conversations for a project
      .get(
        "/",
        async ({ params, set }) => {
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
          params: z.object({ id: z.string() }),
          response: { 200: ConversationListResponse, 404: ErrorResponse },
          detail: {
            summary: "List conversations for project",
            tags: ["Conversations"],
            operationId: "listConversations",
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

          // Check if there's an active generation
          const activeStream = await ctx.streams.getActiveByKey(params.conversationId)
          const isGenerating = activeStream !== null

          return { ...result.data, isGenerating }
        },
        {
          params: z.object({ id: z.string(), conversationId: z.string().uuid() }),
          response: { 200: ConversationWithMessagesResponse, 404: ErrorResponse },
          detail: {
            summary: "Get conversation with messages",
            tags: ["Conversations"],
            operationId: "getConversation",
          },
        }
      )
      // Delete a specific conversation
      .delete(
        "/:conversationId",
        async ({ params }) => {
          const result = await controller.delete(params.conversationId)
          return result.success ? result.data : { success: false }
        },
        {
          params: z.object({ id: z.string(), conversationId: z.string().uuid() }),
          response: { 200: SuccessResponse },
          detail: {
            summary: "Delete conversation",
            tags: ["Conversations"],
            operationId: "deleteConversation",
          },
        }
      )
      // Clear all conversations for a project
      .delete(
        "/",
        async ({ params }) => {
          const result = await controller.clearProject(params.id)
          return result.success ? result.data : { success: false }
        },
        {
          params: z.object({ id: z.string() }),
          response: { 200: SuccessResponse },
          detail: {
            summary: "Clear all conversations for project",
            tags: ["Conversations"],
            operationId: "clearConversations",
          },
        }
      )
      // Send a message (starts AI generation)
      .post(
        "/:conversationId/messages",
        async ({ params, body, set }) => {
          const { id: projectId, conversationId } = params
          const { content } = body

          // Verify conversation exists
          const convResult = await controller.getById(conversationId)
          if (!convResult.success) {
            set.status = convResult.status
            return { error: convResult.error }
          }

          // Cancel any existing generation
          abortControllers.get(conversationId)?.abort()

          // Create user message
          const userMessage = await ctx.db.messages.create({
            conversationId,
            role: "user",
            content,
          })

          // Create stream for this generation (key=conversationId for lookup)
          const streamId = crypto.randomUUID()
          await ctx.streams.create(streamId, conversationId)

          const abortController = new AbortController()
          abortControllers.set(conversationId, abortController)

          // Start generation in background (don't await)
          runGeneration(ctx, {
            projectId,
            conversationId,
            streamId,
            content,
            abortController,
          }).finally(() => {
            abortControllers.delete(conversationId)
          })

          return { message: userMessage }
        },
        {
          params: z.object({ id: z.string(), conversationId: z.string().uuid() }),
          body: SendMessageRequest,
          response: { 200: SendMessageResponse, 404: ErrorResponse },
          detail: {
            summary: "Send a message",
            tags: ["Conversations"],
            operationId: "sendMessage",
          },
        }
      )
      // SSE stream for generation events
      .get(
        "/:conversationId/events",
        async ({ params, set }) => {
          const { conversationId } = params

          // Find active stream for this conversation
          const stream = await ctx.streams.getActiveByKey(conversationId)
          if (!stream) {
            set.status = 404
            return new Response(JSON.stringify({ error: "No active generation" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            })
          }

          const sseStream = createSSEStream(async (sseCtx) => {
            try {
              // Subscribe to stream events (replays past events, then live)
              for await (const { sequence, event } of ctx.streams.subscribe(stream.id)) {
                if (!sseCtx.isOpen) break
                sseCtx.send("message", { ...(event as AIEvent), sequence })
              }
            } finally {
              sseCtx.close()
            }
          })

          return sseResponse(sseStream)
        },
        {
          params: z.object({ id: z.string(), conversationId: z.string().uuid() }),
          detail: {
            summary: "Stream generation events (SSE)",
            tags: ["Conversations"],
            operationId: "streamEvents",
          },
        }
      )
      // Stop ongoing generation
      .post(
        "/:conversationId/stop",
        async ({ params, set }) => {
          const { conversationId } = params
          const stream = await ctx.streams.getActiveByKey(conversationId)
          const abortController = abortControllers.get(conversationId)

          if (!stream && !abortController) {
            set.status = 404
            return { error: "No active generation" }
          }

          if (stream) await ctx.streams.abort(stream.id)
          abortController?.abort()

          return { success: true }
        },
        {
          params: z.object({ id: z.string(), conversationId: z.string().uuid() }),
          response: { 200: SuccessResponse, 404: ErrorResponse },
          detail: {
            summary: "Stop ongoing generation",
            tags: ["Conversations"],
            operationId: "stopGeneration",
          },
        }
      )
  )
}

// ============================================================================
// Background Generation
// ============================================================================

interface GenerationParams {
  projectId: string
  conversationId: string
  streamId: string
  content: string
  abortController: AbortController
}

async function runGeneration(ctx: Context, params: GenerationParams): Promise<void> {
  const { projectId, conversationId, streamId, content, abortController } = params

  // Track assistant text for saving on abort
  let assistantText = ""

  try {
    // Get conversation history from DB
    const messages = await ctx.db.messages.findByConversationId(conversationId)
    const history = messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))

    for await (const event of runAgentChat(ctx, {
      projectId,
      conversationId,
      content,
      history,
      signal: abortController.signal,
    })) {
      // Track text for saving partial response on abort
      if (event.type === "text-delta") {
        assistantText += event.content
      }
      await ctx.streams.append(streamId, event)
    }

    await ctx.streams.complete(streamId)
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      // Save partial assistant message if any text was generated
      if (assistantText.trim()) {
        await ctx.db.messages.create({
          conversationId,
          role: "assistant",
          content: assistantText,
        })
      }
      await ctx.db.conversations.update(conversationId, { status: "active" })
      await ctx.streams.abort(streamId)
    } else {
      const message = err instanceof Error ? err.message : "Unknown error"
      // Append error and finish events BEFORE marking stream as failed
      await ctx.streams.append(streamId, { type: "error", message } satisfies AIEvent)
      await ctx.streams.append(streamId, {
        type: "finish",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      } satisfies AIEvent)
      await ctx.streams.fail(streamId, message)
    }
  }
}
