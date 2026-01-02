/**
 * Agent Service
 *
 * Application service for orchestrating AI chat with compute environment.
 * Handles message persistence and AI streaming.
 *
 * Note: Simple CRUD operations (create, list, delete conversations) should
 * use ctx.db.conversations directly. This service only contains operations
 * that require orchestration logic.
 */

import type { Context } from "../context"
import type { AIEvent, AIMessage } from "../ports"
import type { Conversation } from "../domain"

// ============================================================================
// Constants
// ============================================================================

/** Maximum length for auto-generated conversation titles */
const MAX_TITLE_LENGTH = 50

// ============================================================================
// Types
// ============================================================================

/** Input for starting an agent chat */
export type AgentChatInput = {
  /** Project ID (for conversation ownership) */
  projectId: string
  /** Conversation ID to chat within */
  conversationId: string
  /** Workspace ID (for compute environment) */
  workspaceId: string
  /** User message content */
  content: string
  /** Optional message history override (if not provided, fetches from DB) */
  history?: Array<{ role: "user" | "assistant"; content: string }>
  /** Abort signal for cancellation */
  signal?: AbortSignal
}

/** Result of an agent chat */
export type AgentChatResult = {
  /** Conversation ID */
  conversationId: string
  /** Assistant's response text */
  text: string
  /** Token usage */
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a title from the first user message.
 */
function generateTitle(content: string): string {
  const trimmed = content.trim()
  if (trimmed.length <= MAX_TITLE_LENGTH) {
    return trimmed
  }
  return trimmed.slice(0, MAX_TITLE_LENGTH - 3) + "..."
}

/**
 * Run an agent chat session within an existing conversation.
 *
 * This service handles the full orchestration:
 * 1. Validates conversation exists
 * 2. Fetches message history from DB
 * 3. Saves user message and updates status (transaction)
 * 4. Streams AI response
 * 5. Saves assistant response and updates status (transaction)
 *
 * @param ctx - Application context
 * @param input - Chat input
 * @yields AIEvent - Stream of events for real-time updates
 * @returns AgentChatResult - Final result with conversation ID and response
 */
export async function* runAgentChat(
  ctx: Context,
  input: AgentChatInput
): AsyncGenerator<AIEvent, AgentChatResult> {
  const conversationId = input.conversationId

  // 1. Validate conversation exists
  const conversation = await ctx.db.conversations.findById(conversationId)
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`)
  }

  // 2. Build message history
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
  const isFirstMessage = messageHistory.length === 0

  // Add user message to history
  messageHistory.push({ role: "user", content: input.content })

  // 3. Save user message and update conversation status (atomic operation)
  await ctx.db.transaction(async (uow) => {
    await uow.messages.create({
      conversationId,
      role: "user",
      content: input.content,
    })

    // Auto-generate title from first message if not set
    const updates: Conversation.UpdateInput = { status: "streaming" }
    if (isFirstMessage && !conversation.title) {
      updates.title = generateTitle(input.content)
    }

    await uow.conversations.update(conversationId, updates)
  })

  // 4. Get compute and stream AI response
  const computer = ctx.getCompute(input.workspaceId)

  let assistantText = ""
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  try {
    for await (const event of ctx.ai.streamChat({
      messages: messageHistory,
      signal: input.signal,
      computer,
      getTerminal: () => computer.getOrCreateAgentTerminal(),
    })) {
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

    // 5. Save assistant message and update conversation status (atomic operation)
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
