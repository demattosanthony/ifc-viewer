/**
 * Message Entity
 *
 * Represents a single message in a conversation.
 * Messages are composed of parts (text or tool usage).
 */

import { z } from "zod"

// ============================================================================
// Part Schemas & Types
// ============================================================================

export const ToolUseStatusSchema = z.enum(["success", "error", "aborted"])

export const MessagePartTextSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
})

export const MessagePartToolUseSchema = z.object({
  type: z.literal("tool-use"),
  id: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
  output: z.unknown().optional(),
  status: ToolUseStatusSchema,
  error: z.string().optional(),
})

export const MessagePartSchema = z.discriminatedUnion("type", [
  MessagePartTextSchema,
  MessagePartToolUseSchema,
])

export type ToolUseStatus = z.infer<typeof ToolUseStatusSchema>
export type MessagePartText = z.infer<typeof MessagePartTextSchema>
export type MessagePartToolUse = z.infer<typeof MessagePartToolUseSchema>
export type MessagePart = z.infer<typeof MessagePartSchema>

// ============================================================================
// Message Schema & Types
// ============================================================================

export const MessageRoleSchema = z.enum(["user", "assistant", "system"])

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: MessageRoleSchema,
  parts: z.array(MessagePartSchema),
  createdAt: z.date(),
})

export type MessageRole = z.infer<typeof MessageRoleSchema>
export type Message = z.infer<typeof MessageSchema>

/** Namespace for Message-related input types */
export namespace Message {
  export type CreateInput = {
    conversationId: string
    role: MessageRole
    parts: MessagePart[]
  }
}
