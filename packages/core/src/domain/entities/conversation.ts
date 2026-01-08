/**
 * Conversation Entity
 *
 * Represents an AI chat session within a project.
 */

import { z } from "zod"

// ============================================================================
// Schema & Types
// ============================================================================

export const ConversationStatusSchema = z.enum(["active", "streaming", "completed", "aborted"])

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string(), // Project slug (not UUID)
  title: z.string().nullable(), // Auto-generated from first message
  status: ConversationStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type ConversationStatus = z.infer<typeof ConversationStatusSchema>
export type Conversation = z.infer<typeof ConversationSchema>

/** Namespace for Conversation-related input types */
export namespace Conversation {
  export type CreateInput = {
    projectId: string
    title?: string | null
  }

  export type UpdateInput = {
    title?: string | null
    status?: ConversationStatus
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if conversation is still active.
 */
export function isConversationActive(conversation: Conversation): boolean {
  return conversation.status === "active" || conversation.status === "streaming"
}
