import { v4 as uuidv4 } from "uuid"
import type { Message, MessageOps, CreateMessageInput } from "@ifc-viewer/core"

export function createMemoryMessageOps(): MessageOps {
  const messages = new Map<string, Message>()

  return {
    async create(input: CreateMessageInput): Promise<Message> {
      const message: Message = {
        id: uuidv4(),
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        createdAt: new Date(),
      }
      messages.set(message.id, message)
      return message
    },

    async findByConversationId(conversationId: string): Promise<Message[]> {
      return Array.from(messages.values())
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    },
  }
}
