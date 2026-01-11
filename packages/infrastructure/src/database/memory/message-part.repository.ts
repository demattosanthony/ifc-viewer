import type { MessagePart, MessagePartRepository } from "@ifc-viewer/core"

export function createMessagePartRepository(): MessagePartRepository {
  const store = new Map<string, MessagePart[]>()

  return {
    async createMany(messageId: string, parts: MessagePart[]): Promise<void> {
      store.set(messageId, [...parts])
    },

    async findByMessageId(messageId: string): Promise<MessagePart[]> {
      return store.get(messageId) ?? []
    },

    async findByMessageIds(messageIds: string[]): Promise<Map<string, MessagePart[]>> {
      const result = new Map<string, MessagePart[]>()
      for (const id of messageIds) {
        const parts = store.get(id)
        if (parts) {
          result.set(id, parts)
        }
      }
      return result
    },
  }
}
