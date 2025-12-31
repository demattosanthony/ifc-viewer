import { v4 as uuidv4 } from "uuid";
import {
  type Message,
  type MessageRepository,
  type CreateMessageInput,
  createMessage,
} from "@ifc-viewer/core";

export function createMemoryMessageRepository(): MessageRepository {
  const messages = new Map<string, Message>();

  return {
    async create(input: CreateMessageInput): Promise<Message> {
      const message = createMessage({
        id: uuidv4(),
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
      });
      messages.set(message.id, message);
      return message;
    },

    async findById(id: string): Promise<Message | null> {
      return messages.get(id) ?? null;
    },

    async findByConversationId(conversationId: string): Promise<Message[]> {
      return Array.from(messages.values())
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },

    async delete(id: string): Promise<void> {
      messages.delete(id);
    },

    async deleteByConversationId(conversationId: string): Promise<void> {
      for (const [id, message] of messages) {
        if (message.conversationId === conversationId) {
          messages.delete(id);
        }
      }
    },
  };
}
