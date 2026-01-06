import { generateId } from "@ifc-viewer/core"
import type { Message, MessageRepository } from "@ifc-viewer/core"

export function createMessageRepository(): MessageRepository {
  const store = new Map<string, Message>()

  return {
    async create(input: Message.CreateInput): Promise<Message> {
      const entity: Message = {
        id: generateId(),
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        createdAt: new Date(),
      }
      store.set(entity.id, entity)
      return entity
    },

    async findByConversationId(conversationId: string): Promise<Message[]> {
      return Array.from(store.values())
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    },
  }
}
