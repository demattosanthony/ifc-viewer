import type { Message, CreateMessageInput } from "../schema/message"

/** Create a new message from input */
export const createMessage = (
  input: CreateMessageInput & { id: string }
): Message => ({
  id: input.id,
  conversationId: input.conversationId,
  role: input.role,
  content: input.content,
  createdAt: new Date(),
})

/** Check if message is from user */
export const isUserMessage = (message: Message): boolean =>
  message.role === "user"

/** Check if message is from assistant */
export const isAssistantMessage = (message: Message): boolean =>
  message.role === "assistant"
