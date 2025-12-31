import { v4 as uuidv4 } from "uuid";
import {
  type Conversation,
  type ConversationRepository,
  type CreateConversationInput,
  type UpdateConversationInput,
  createConversation,
} from "@ifc-viewer/core";

export function createMemoryConversationRepository(): ConversationRepository {
  const conversations = new Map<string, Conversation>();

  return {
    async create(input: CreateConversationInput): Promise<Conversation> {
      const conversation = createConversation({
        id: uuidv4(),
        workspaceId: input.workspaceId,
      });
      conversations.set(conversation.id, conversation);
      return conversation;
    },

    async findById(id: string): Promise<Conversation | null> {
      return conversations.get(id) ?? null;
    },

    async findByWorkspaceId(workspaceId: string): Promise<Conversation[]> {
      return Array.from(conversations.values()).filter(
        (c) => c.workspaceId === workspaceId
      );
    },

    async findActiveByWorkspaceId(workspaceId: string): Promise<Conversation | null> {
      for (const conversation of conversations.values()) {
        if (conversation.workspaceId === workspaceId && conversation.status === "active") {
          return conversation;
        }
      }
      return null;
    },

    async update(id: string, input: UpdateConversationInput): Promise<Conversation> {
      const existing = conversations.get(id);
      if (!existing) {
        throw new Error(`Conversation ${id} not found`);
      }
      const updated = createConversation({
        ...existing,
        status: input.status ?? existing.status,
        updatedAt: new Date(),
      });
      conversations.set(id, updated);
      return updated;
    },

    async delete(id: string): Promise<void> {
      conversations.delete(id);
    },

    async deleteByWorkspaceId(workspaceId: string): Promise<void> {
      for (const [id, conversation] of conversations) {
        if (conversation.workspaceId === workspaceId) {
          conversations.delete(id);
        }
      }
    },

    async exists(id: string): Promise<boolean> {
      return conversations.has(id);
    },
  };
}
