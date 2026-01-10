/**
 * Conversation DTOs
 *
 * Request/response schemas for conversation and chat operations.
 */

import { ConversationSchema, MessageSchema } from "@ifc-viewer/core"
import { z } from "zod"

// ============================================================================
// Request DTOs
// ============================================================================

/** Create conversation request */
export const CreateConversationRequest = z.object({
  title: z.string().optional(),
})
export type CreateConversationRequest = z.infer<typeof CreateConversationRequest>

/** Send message request */
export const SendMessageRequest = z.object({
  content: z.string(),
})
export type SendMessageRequest = z.infer<typeof SendMessageRequest>

// ============================================================================
// Response DTOs
// ============================================================================

/** Message response */
export const MessageResponse = MessageSchema
export type MessageResponse = z.infer<typeof MessageResponse>

/** Conversation response */
export const ConversationResponse = ConversationSchema
export type ConversationResponse = z.infer<typeof ConversationResponse>

/** Conversation list response */
export const ConversationListResponse = z.array(ConversationResponse)
export type ConversationListResponse = z.infer<typeof ConversationListResponse>

/** Conversation with messages (internal - without isGenerating) */
export const ConversationWithMessages = ConversationSchema.extend({
  messages: z.array(MessageResponse),
})
export type ConversationWithMessages = z.infer<typeof ConversationWithMessages>

/** Conversation with messages response (API response - includes isGenerating) */
export const ConversationWithMessagesResponse = ConversationWithMessages.extend({
  isGenerating: z.boolean(),
})
export type ConversationWithMessagesResponse = z.infer<typeof ConversationWithMessagesResponse>

/** Send message response */
export const SendMessageResponse = z.object({
  message: MessageResponse,
})
export type SendMessageResponse = z.infer<typeof SendMessageResponse>
