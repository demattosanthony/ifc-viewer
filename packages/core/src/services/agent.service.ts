/**
 * Agent Service
 *
 * Orchestrates AI chat with compute environment.
 * Compute is created on-demand and disposed after 5 minutes of inactivity.
 * File changes are tracked via ChangeTracker and persisted on compute disposal.
 */

import type { Context } from "../context"
import type { Conversation, Message, MessagePartText } from "../domain"
import { NotFoundError } from "../domain/errors"
import type { AIEvent, AIMessage, AIMessageTextPart, AIMessageToolCallPart } from "../ports"

const MAX_TITLE_LENGTH = 50

// ============================================================================
// Types
// ============================================================================

export type AgentChatInput = {
  projectId: string
  conversationId: string
  content: string
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
  return trimmed.length <= MAX_TITLE_LENGTH
    ? trimmed
    : `${trimmed.slice(0, MAX_TITLE_LENGTH - 3)}...`
}

/**
 * Convert persisted messages to AI SDK format.
 * Handles multi-part messages with tool calls and results.
 */
function toAIMessages(messages: Message[]): AIMessage[] {
  const result: AIMessage[] = []

  for (const msg of messages) {
    if (msg.role === "user" || msg.role === "system") {
      // User/system messages: extract text from parts
      const text = msg.parts
        .filter((p): p is MessagePartText => p.type === "text")
        .map((p) => p.text)
        .join("")
      result.push({ role: msg.role, content: text })
      continue
    }

    // Assistant message: build parts with tool calls
    const contentParts: (AIMessageTextPart | AIMessageToolCallPart)[] = []
    const toolResults: { id: string; name: string; output: unknown }[] = []

    for (const part of msg.parts) {
      if (part.type === "text" && part.text.trim()) {
        contentParts.push({ type: "text", text: part.text })
      } else if (part.type === "tool-use") {
        contentParts.push({
          type: "tool-call",
          toolCallId: part.id,
          toolName: part.name,
          input: part.input,
        })
        if (part.output !== undefined) {
          toolResults.push({ id: part.id, name: part.name, output: part.output })
        }
      }
    }

    if (contentParts.length > 0) {
      result.push({ role: "assistant", content: contentParts })
    }

    // Add tool result messages
    for (const tr of toolResults) {
      result.push({
        role: "tool",
        content: [{ type: "tool-result", toolCallId: tr.id, toolName: tr.name, output: tr.output }],
      })
    }
  }

  return result
}

/**
 * Run an agent chat session within an existing conversation.
 *
 * This service handles the full orchestration:
 * 1. Validates project and conversation exist
 * 2. Creates compute environment on-demand (if not already running)
 * 3. Fetches message history from DB and converts to AI format
 * 4. Updates conversation status
 * 5. Streams AI response
 * 6. Updates conversation status on completion
 *
 * Note: The caller is responsible for creating messages (user message before,
 * assistant message after). This service focuses on AI orchestration.
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

  // 3. Build message history from DB
  const messages = await ctx.db.messages.findByConversationId(conversationId)
  const messageHistory = toAIMessages(messages)

  // Check if this is the first message (for auto-generating title)
  const isFirstMessage = messages.length <= 1

  // 4. Update conversation status
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

    // 6. Update conversation status on success
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
