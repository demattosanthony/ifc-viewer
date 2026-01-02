/**
 * Message Entity
 *
 * Represents a single message in a conversation.
 */

import { z } from "zod"

// ============================================================================
// Schema & Types
// ============================================================================

export const MessageRoleSchema = z.enum(["user", "assistant", "system"])

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  createdAt: z.date(),
})

export type MessageRole = z.infer<typeof MessageRoleSchema>
export type Message = z.infer<typeof MessageSchema>

/** Namespace for Message-related input types */
export namespace Message {
  export type CreateInput = {
    conversationId: string
    role: MessageRole
    content: string
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if message is from the user.
 */
export function isUserMessage(message: Message): boolean {
  return message.role === "user"
}

/**
 * Check if message is from the assistant.
 */
export function isAssistantMessage(message: Message): boolean {
  return message.role === "assistant"
}

/**
 * Check if message is a system message.
 */
export function isSystemMessage(message: Message): boolean {
  return message.role === "system"
}
