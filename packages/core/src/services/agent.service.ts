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
import type { AIEvent, AIMessage, AIMessageToolCallPart } from "../ports"

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
 * Check if conversation history contains executePython tool calls.
 * Used to detect if Python REPL state needs to be restored.
 */
function hasPythonReplHistory(messages: Message[]): boolean {
  return messages.some((msg) =>
    msg.parts.some((part) => part.type === "tool-use" && part.name === "executePython")
  )
}

const PYTHON_REPL_RESET_MESSAGE = `Note: The Python REPL session has been reset due to inactivity. Variables, imports, and state from previous Python executions in this conversation are no longer available. If you need to reference data from earlier operations, you will need to re-run the relevant code (e.g., re-open IFC files, re-import modules, recreate variables).`

/**
 * Convert persisted messages to AI SDK format.
 * Handles multi-part messages with tool calls and results.
 *
 * Important: Anthropic requires:
 * 1. Tool calls in an assistant message must be followed by tool results
 * 2. Text that comes after tool execution must be in a SEPARATE assistant message
 *    after the tool results, not bundled with the tool calls
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

    // Assistant message: separate tool calls from text
    // Text that appears after tool calls is the response to tool results,
    // so it must come in a separate assistant message AFTER the tool results
    const toolCallParts: AIMessageToolCallPart[] = []
    const toolResults: {
      type: "tool-result"
      toolCallId: string
      toolName: string
      output: unknown
    }[] = []
    const textParts: string[] = []

    for (const part of msg.parts) {
      if (part.type === "text" && part.text.trim()) {
        textParts.push(part.text)
      } else if (part.type === "tool-use" && part.output !== undefined) {
        // Only include tool calls that have outputs (Anthropic requires matching pairs)
        toolCallParts.push({
          type: "tool-call",
          toolCallId: part.id,
          toolName: part.name,
          input: part.input,
        })
        toolResults.push({
          type: "tool-result",
          toolCallId: part.id,
          toolName: part.name,
          output: part.output,
        })
      }
      // Skip tool-use parts without outputs (incomplete from aborted sessions)
    }

    // If there are tool calls, add them first, then results, then text response
    if (toolCallParts.length > 0) {
      // Assistant message with tool calls only
      result.push({ role: "assistant", content: toolCallParts })

      // Tool results immediately after
      result.push({ role: "tool", content: toolResults })

      // Text response (if any) comes after tool results in a separate assistant message
      if (textParts.length > 0) {
        result.push({ role: "assistant", content: textParts.join("") })
      }
    } else if (textParts.length > 0) {
      // No tool calls, just text
      result.push({ role: "assistant", content: textParts.join("") })
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
  const { computer, tracker, isNew } = await ctx.getOrCreateCompute(projectId)

  // 6. If compute is newly created and there's Python REPL history, inject reset notice
  if (isNew && hasPythonReplHistory(messages)) {
    messageHistory.push({
      role: "user",
      content: PYTHON_REPL_RESET_MESSAGE,
    })
  }

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
