/**
 * Agent Service
 *
 * Application service for orchestrating AI chat with compute environment.
 * Handles conversation management, message persistence, and AI streaming.
 */

import type { Context } from "../context"
import type { AIEvent, AIMessage } from "../ports"
import type { Conversation } from "../domain"

/** Input for starting an agent chat */
export type AgentChatInput = {
  /** Workspace ID */
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

/**
 * Run an agent chat session.
 *
 * This service handles the full orchestration:
 * 1. Gets or creates conversation for workspace
 * 2. Fetches message history from DB (or uses provided history)
 * 3. Saves user message to DB
 * 4. Streams AI response
 * 5. Saves assistant response to DB
 * 6. Updates conversation status
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
  // 1. Get or create conversation
  let conversation: Conversation | null = await ctx.db.conversations.findActiveByWorkspaceId(
    input.workspaceId
  )
  if (!conversation) {
    conversation = await ctx.db.conversations.create({ workspaceId: input.workspaceId })
  }

  const conversationId = conversation.id

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

  // Add user message to history
  messageHistory.push({ role: "user", content: input.content })

  // 3. Save user message to DB
  await ctx.db.messages.create({
    conversationId,
    role: "user",
    content: input.content,
  })

  // 4. Update conversation status to streaming
  await ctx.db.conversations.update(conversationId, { status: "streaming" })

  // 5. Get compute and stream AI response
  const computer = ctx.getCompute(input.workspaceId)

  let assistantText = ""
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  try {
    for await (const event of ctx.ai.streamChat({
      messages: messageHistory,
      signal: input.signal,
      computer,
      getTerminal: () => computer.getOrCreateAgentTerminal(),
      // No onEvent callback - events are yielded, not double-emitted
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

    // 6. Save assistant message to DB (if there was any text)
    if (assistantText) {
      await ctx.db.messages.create({
        conversationId,
        role: "assistant",
        content: assistantText,
      })
    }

    // 7. Update conversation status to active
    await ctx.db.conversations.update(conversationId, { status: "active" })
  } catch (error) {
    // Handle abort
    if (error instanceof Error && error.name === "AbortError") {
      await ctx.db.conversations.update(conversationId, { status: "aborted" })
    } else {
      // Re-throw other errors
      throw error
    }
  }

  return { conversationId, text: assistantText, usage }
}

/**
 * Get conversation with messages for a workspace
 */
export async function getConversation(ctx: Context, workspaceId: string) {
  const conversation = await ctx.db.conversations.findActiveByWorkspaceId(workspaceId)
  if (!conversation) {
    return null
  }

  const messages = await ctx.db.messages.findByConversationId(conversation.id)

  return {
    ...conversation,
    messages,
  }
}

/**
 * Clear conversation history for a workspace
 */
export async function clearConversation(ctx: Context, workspaceId: string): Promise<void> {
  await ctx.db.conversations.deleteByWorkspaceId(workspaceId)
}
