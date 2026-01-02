import { v4 as uuidv4 } from "uuid"
import type { Message, Database } from "@ifc-viewer/core"

export function createMessageRepository(): Database.MessageRepository {
  const store = new Map<string, Message.Entity>()

  return {
    async create(input: Message.CreateInput): Promise<Message.Entity> {
      const entity: Message.Entity = {
        id: uuidv4(),
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        createdAt: new Date(),
      }
      store.set(entity.id, entity)
      return entity
    },

    async findByConversationId(conversationId: string): Promise<Message.Entity[]> {
      return Array.from(store.values())
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    },
  }
}
