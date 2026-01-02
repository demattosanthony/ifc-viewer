/**
 * Conversation Entity
 *
 * Represents an AI chat session within a workspace.
 */

import { z } from "zod"

// ============================================================================
// Schema & Types
// ============================================================================

export const ConversationStatusSchema = z.enum(["active", "streaming", "completed", "aborted"])

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  status: ConversationStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type ConversationStatus = z.infer<typeof ConversationStatusSchema>
export type Conversation = z.infer<typeof ConversationSchema>

/** Namespace for Conversation-related input types */
export namespace Conversation {
  export type CreateInput = {
    workspaceId: string
  }

  export type UpdateInput = {
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
