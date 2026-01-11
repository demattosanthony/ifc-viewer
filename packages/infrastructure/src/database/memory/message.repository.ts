import type { Message, MessageRepository } from "@ifc-viewer/core"
import { generateId, MessageSchema } from "@ifc-viewer/core"

import { createMessagePartRepository } from "./message-part.repository"

export function createMessageRepository(): MessageRepository {
  const store = new Map<string, Message>()
  const partsRepo = createMessagePartRepository()

  return {
    async create(input: Message.CreateInput): Promise<Message> {
      const id = generateId()
      const entity = MessageSchema.parse({
        id,
        conversationId: input.conversationId,
        role: input.role,
        parts: input.parts,
        createdAt: new Date(),
      })

      await partsRepo.createMany(id, input.parts)
      store.set(entity.id, entity)
      return entity
    },

    async findByConversationId(conversationId: string): Promise<Message[]> {
      const messages = Array.from(store.values())
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

      // Refresh parts from partsRepo (in case they were updated)
      const messageIds = messages.map((m) => m.id)
      const partsMap = await partsRepo.findByMessageIds(messageIds)

      return messages.map((m) => ({
        ...m,
        parts: partsMap.get(m.id) ?? m.parts,
      }))
    },
  }
}
