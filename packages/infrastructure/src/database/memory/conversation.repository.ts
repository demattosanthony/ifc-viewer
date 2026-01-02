import { v4 as uuidv4 } from "uuid"
import type { Conversation, ConversationRepository } from "@ifc-viewer/core"

export function createConversationRepository(): ConversationRepository {
  const store = new Map<string, Conversation>()

  return {
    async create(input: Conversation.CreateInput): Promise<Conversation> {
      const now = new Date()
      const entity: Conversation = {
        id: uuidv4(),
        workspaceId: input.workspaceId,
        status: "active",
        createdAt: now,
        updatedAt: now,
      }
      store.set(entity.id, entity)
      return entity
    },

    async findActiveByWorkspaceId(workspaceId: string): Promise<Conversation | null> {
      for (const entity of store.values()) {
        if (entity.workspaceId === workspaceId && entity.status === "active") {
          return entity
        }
      }
      return null
    },

    async update(id: string, input: Conversation.UpdateInput): Promise<Conversation> {
      const existing = store.get(id)
      if (!existing) throw new Error(`Conversation ${id} not found`)

      const updated: Conversation = {
        ...existing,
        status: input.status ?? existing.status,
        updatedAt: new Date(),
      }
      store.set(id, updated)
      return updated
    },

    async deleteByWorkspaceId(workspaceId: string): Promise<void> {
      for (const [id, entity] of store) {
        if (entity.workspaceId === workspaceId) {
          store.delete(id)
        }
      }
    },
  }
}
