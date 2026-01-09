/**
 * Agent Service
 *
 * Orchestrates AI chat with compute environment.
 * Compute is created on-demand and disposed after 5 minutes of inactivity.
 * File changes are tracked via ChangeTracker and persisted on compute disposal.
 */

import type { Context } from "../context"
import type { AIEvent, AIMessage } from "../ports"
import type { Conversation } from "../domain"
import { NotFoundError } from "../domain/errors"

const MAX_TITLE_LENGTH = 50

// ============================================================================
// Types
// ============================================================================

export type AgentChatInput = {
  projectId: string
  conversationId: string
  content: string
  history?: Array<{ role: "user" | "assistant"; content: string }>
  signal?: AbortSignal
}

export type AgentChatResult = {
  conversationId: string
  text: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

// ============================================================================
// Helpers
// ============================================================================

function generateTitle(content: string): string {
  const trimmed = content.trim()
  return trimmed.length <= MAX_TITLE_LENGTH ? trimmed : trimmed.slice(0, MAX_TITLE_LENGTH - 3) + "..."
}

/**
 * Run an agent chat session within an existing conversation.
 *
 * This service handles the full orchestration:
 * 1. Validates project and conversation exist
 * 2. Creates compute environment on-demand (if not already running)
 * 3. Fetches message history from DB
 * 4. Saves user message and updates status (transaction)
 * 5. Streams AI response
 * 6. Saves assistant response and updates status (transaction)
 *
 * File changes are tracked via ChangeTracker and persisted when compute is disposed.
 *
 * @param ctx - Application context
 * @param input - Chat input (projectId, conversationId, content)
 * @yields AIEvent - Stream of events for real-time updates
 * @returns AgentChatResult - Final result with conversation ID and response
 */
export async function* runAgentChat(
  ctx: Context,
  input: AgentChatInput
): AsyncGenerator<AIEvent, AgentChatResult> {
  const { projectId, conversationId } = input

  // 1. Validate project exists
  const project = await ctx.db.projects.findById(projectId)
  if (!project) {
    throw new NotFoundError("Project", projectId)
  }

  // 2. Validate conversation exists
  const conversation = await ctx.db.conversations.findById(conversationId)
  if (!conversation) {
    throw new NotFoundError("Conversation", conversationId)
  }

  // 3. Build message history
  let messageHistory: AIMessage[]

  if (input.history && input.history.length > 0) {
    messageHistory = input.history.map((m) => ({
      role: m.role,
      content: m.content,
    }))
  } else {
    const messages = await ctx.db.messages.findByConversationId(conversationId)
    messageHistory = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))
  }

  // Check if this is the first message (for auto-generating title)
  // Note: The user message is already in history (created by the route)
  const isFirstMessage = messageHistory.length <= 1

  // 4. Update conversation status (user message already created by route)
  const updates: Conversation.UpdateInput = { status: "streaming" }
  if (isFirstMessage && !conversation.title) {
    updates.title = generateTitle(input.content)
  }
  await ctx.db.conversations.update(conversationId, updates)

  // 5. Get or create compute for this project (on-demand)
  const { computer, tracker } = await ctx.getOrCreateCompute(projectId)

  let assistantText = ""
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  try {
    for await (const event of ctx.ai.streamChat({
      messages: messageHistory,
      signal: input.signal,
      computer,
      changeTracker: tracker,
      getTerminal: () => computer.getOrCreateAgentTerminal(),
    })) {
      // Keep compute alive during long AI sessions
      if (event.type === "step-start" || event.type === "tool-call") {
        ctx.touchCompute(projectId)
      }

      // Track text for final result
      if (event.type === "text-delta") {
        assistantText += event.content
      }

      // Track usage for final result
      if (event.type === "finish") {
        usage = event.usage
      }

      // Yield event to caller
      yield event
    }

    // 6. Save assistant message and update conversation status (atomic operation)
    await ctx.db.transaction(async (uow) => {
      if (assistantText) {
        await uow.messages.create({
          conversationId,
          role: "assistant",
          content: assistantText,
        })
      }
      await uow.conversations.update(conversationId, { status: "active" })
    })
  } catch (error) {
    // Handle abort - single operation, no transaction needed
    if (error instanceof Error && error.name === "AbortError") {
      await ctx.db.conversations.update(conversationId, { status: "aborted" })
    } else {
      // Re-throw other errors
      throw error
    }
  }

  return { conversationId, text: assistantText, usage }
}
