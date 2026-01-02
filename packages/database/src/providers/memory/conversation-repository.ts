import { v4 as uuidv4 } from "uuid"
import type {
  Conversation,
  ConversationOps,
  CreateConversationInput,
  UpdateConversationInput,
} from "@ifc-viewer/core"

export function createMemoryConversationOps(): ConversationOps {
  const conversations = new Map<string, Conversation>()

  return {
    async create(input: CreateConversationInput): Promise<Conversation> {
      const now = new Date()
      const conversation: Conversation = {
        id: uuidv4(),
        workspaceId: input.workspaceId,
        status: "active",
        createdAt: now,
        updatedAt: now,
      }
      conversations.set(conversation.id, conversation)
      return conversation
    },

    async findActiveByWorkspaceId(workspaceId: string): Promise<Conversation | null> {
      for (const conversation of conversations.values()) {
        if (conversation.workspaceId === workspaceId && conversation.status === "active") {
          return conversation
        }
      }
      return null
    },

    async update(id: string, input: UpdateConversationInput): Promise<Conversation> {
      const existing = conversations.get(id)
      if (!existing) throw new Error(`Conversation ${id} not found`)

      const updated: Conversation = {
        ...existing,
        status: input.status ?? existing.status,
        updatedAt: new Date(),
      }
      conversations.set(id, updated)
      return updated
    },

    async deleteByWorkspaceId(workspaceId: string): Promise<void> {
      for (const [id, conversation] of conversations) {
        if (conversation.workspaceId === workspaceId) {
          conversations.delete(id)
        }
      }
    },
  }
}
