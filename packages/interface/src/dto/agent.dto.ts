/**
 * Conversation DTOs
 *
 * Request/response schemas for conversation and chat operations.
 */

import { z } from "zod"
import { ConversationSchema, MessageSchema } from "@ifc-viewer/core"

// ============================================================================
// Request DTOs
// ============================================================================

/** Create conversation request */
export const CreateConversationRequest = z.object({
  title: z.string().optional(),
})
export type CreateConversationRequest = z.infer<typeof CreateConversationRequest>

/** Chat message in history */
export const ChatHistoryMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
})
export type ChatHistoryMessage = z.infer<typeof ChatHistoryMessage>

/** Start chat request - requires workspaceId for compute */
export const StartChatRequest = z.object({
  workspaceId: z.string().uuid(),
  content: z.string(),
  history: z.array(ChatHistoryMessage).optional(),
})
export type StartChatRequest = z.infer<typeof StartChatRequest>

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

/** Conversation with messages response */
export const ConversationWithMessagesResponse = ConversationSchema.extend({
  messages: z.array(MessageResponse),
})
export type ConversationWithMessagesResponse = z.infer<typeof ConversationWithMessagesResponse>
