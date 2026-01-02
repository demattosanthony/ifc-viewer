/**
 * Conversation Use Cases
 *
 * Application logic for AI conversation operations.
 */

import type { Context } from "../context"
import type { Conversation, CreateConversationInput, ConversationStatus } from "../schema/conversation"
import type { Message, CreateMessageInput } from "../schema/message"
import { NotFoundError } from "../errors"

/** Get or create an active conversation for a workspace */
export const getOrCreateConversation = async (
  ctx: Context,
  workspaceId: string
): Promise<Conversation> => {
  // Check for existing active conversation
  const existing = await ctx.db.conversations.findActiveByWorkspaceId(workspaceId)
  if (existing) return existing

  // Create new conversation
  return ctx.db.conversations.create({ workspaceId })
}

/** Get the active conversation for a workspace */
export const getActiveConversation = async (
  ctx: Context,
  workspaceId: string
): Promise<Conversation | null> => {
  return ctx.db.conversations.findActiveByWorkspaceId(workspaceId)
}

/** Update conversation status */
export const updateConversationStatus = async (
  ctx: Context,
  id: string,
  status: ConversationStatus
): Promise<Conversation> => {
  return ctx.db.conversations.update(id, { status })
}

/** Add a message to a conversation */
export const addMessage = async (
  ctx: Context,
  input: CreateMessageInput
): Promise<Message> => {
  return ctx.db.messages.create(input)
}

/** Get all messages in a conversation */
export const getConversationMessages = async (
  ctx: Context,
  conversationId: string
): Promise<Message[]> => {
  return ctx.db.messages.findByConversationId(conversationId)
}

/** Complete a conversation */
export const completeConversation = async (
  ctx: Context,
  id: string
): Promise<Conversation> => {
  return ctx.db.conversations.update(id, { status: "completed" })
}

/** Abort a conversation */
export const abortConversation = async (
  ctx: Context,
  id: string
): Promise<Conversation> => {
  return ctx.db.conversations.update(id, { status: "aborted" })
}

/** Clear all conversation history for a workspace */
export const clearConversationHistory = async (
  ctx: Context,
  workspaceId: string
): Promise<void> => {
  await ctx.db.conversations.deleteByWorkspaceId(workspaceId)
}
