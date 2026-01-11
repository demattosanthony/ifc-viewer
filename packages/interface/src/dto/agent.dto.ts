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

// ============================================================================
// Agent Transport Types
// ============================================================================

export interface AgentChatMessage {
  type: "chat"
  content: string
  history?: Array<{ role: "user" | "assistant"; content: string }>
}

export interface AgentStopMessage {
  type: "stop"
}

export interface AgentApproveToolMessage {
  type: "approve-tool"
  toolCallId: string
}

export interface AgentRejectToolMessage {
  type: "reject-tool"
  toolCallId: string
}

export type AgentClientMessage =
  | AgentChatMessage
  | AgentStopMessage
  | AgentApproveToolMessage
  | AgentRejectToolMessage

// ============================================================================
// Terminal WebSocket Types
// ============================================================================

/** Terminal ready event - connection established */
export interface TerminalReadyEvent {
  type: "ready"
  terminalId: string
}

/** Terminal output event - data from PTY */
export interface TerminalDataEvent {
  type: "output"
  data: string
}

/** Terminal exit event - process terminated */
export interface TerminalExitEvent {
  type: "exit"
  code: number
}

/** Terminal error event */
export interface TerminalErrorEvent {
  type: "error"
  message: string
}

/** Server -> Client terminal events */
export type TerminalServerEvent =
  | TerminalReadyEvent
  | TerminalDataEvent
  | TerminalExitEvent
  | TerminalErrorEvent

/** Client -> Server terminal input */
export interface TerminalInputMessage {
  type: "input"
  data: string
}

/** Client -> Server terminal resize */
export interface TerminalResizeMessage {
  type: "resize"
  cols: number
  rows: number
}

/** Client -> Server terminal messages */
export type TerminalClientMessage = TerminalInputMessage | TerminalResizeMessage
