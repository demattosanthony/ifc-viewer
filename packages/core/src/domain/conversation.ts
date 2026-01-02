import type { Conversation, CreateConversationInput, ConversationStatus } from "../schema/conversation"

/** Create a new conversation from input */
export const createConversation = (
  input: CreateConversationInput & { id: string }
): Conversation => ({
  id: input.id,
  workspaceId: input.workspaceId,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
})

/** Update conversation status */
export const updateConversationStatus = (
  conversation: Conversation,
  status: ConversationStatus
): Conversation => ({
  ...conversation,
  status,
  updatedAt: new Date(),
})

/** Check if conversation can accept new messages */
export const canAcceptMessages = (conversation: Conversation): boolean =>
  conversation.status === "active" || conversation.status === "streaming"
