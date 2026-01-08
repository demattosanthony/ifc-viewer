import { generateId, ConversationSchema } from "@ifc-viewer/core"
import type { Conversation, ConversationRepository } from "@ifc-viewer/core"

export function createConversationRepository(): ConversationRepository {
  const store = new Map<string, Conversation>()

  return {
    async create(input: Conversation.CreateInput): Promise<Conversation> {
      const now = new Date()
      const entity = ConversationSchema.parse({
        id: generateId(),
        projectId: input.projectId,
        title: input.title ?? null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      store.set(entity.id, entity)
      return entity
    },

    async findById(id: string): Promise<Conversation | null> {
      return store.get(id) ?? null
    },

    async findByProjectId(projectId: string): Promise<Conversation[]> {
      const results: Conversation[] = []
      for (const entity of store.values()) {
        if (entity.projectId === projectId) {
          results.push(entity)
        }
      }
      // Sort by updatedAt descending (most recent first)
      return results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    },

    async update(id: string, input: Conversation.UpdateInput): Promise<Conversation> {
      const existing = store.get(id)
      if (!existing) throw new Error(`Conversation ${id} not found`)

      const updated = ConversationSchema.parse({
        ...existing,
        title: input.title !== undefined ? input.title : existing.title,
        status: input.status ?? existing.status,
        updatedAt: new Date(),
      })
      store.set(id, updated)
      return updated
    },

    async delete(id: string): Promise<void> {
      store.delete(id)
    },

    async deleteByProjectId(projectId: string): Promise<void> {
      for (const [id, entity] of store) {
        if (entity.projectId === projectId) {
          store.delete(id)
        }
      }
    },
  }
}
