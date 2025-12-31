import type { ConversationRepository } from "../repositories/conversation-repository";
import type { ConversationStatus, Conversation } from "../entities/conversation";
import { ConversationNotFoundError } from "../errors";
import type { ConversationOutput, MessageOutput } from "./types";

export interface ConversationsClient {
  start(sessionId: string): Promise<ConversationOutput>;
  get(id: string): Promise<ConversationOutput | null>;
  getBySessionId(sessionId: string): Promise<ConversationOutput | null>;
  addMessage(id: string, role: "user" | "assistant", content: string): Promise<MessageOutput>;
  updateStatus(id: string, status: ConversationStatus): Promise<void>;
  delete(id: string): Promise<void>;
  deleteBySessionId(sessionId: string): Promise<void>;
}

export interface ConversationsClientConfig {
  repository: ConversationRepository;
}

export function createConversationsClient(config: ConversationsClientConfig): ConversationsClient {
  const { repository } = config;

  const format = (conversation: Conversation): ConversationOutput => ({
    id: conversation.id,
    sessionId: conversation.sessionId,
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    status: conversation.status,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  });

  return {
    async start(sessionId) {
      const existing = await repository.findBySessionId(sessionId);
      if (existing) return format(existing);

      const conversation = await repository.create({ sessionId });
      return format(conversation);
    },

    async get(id) {
      const conversation = await repository.findById(id);
      return conversation ? format(conversation) : null;
    },

    async getBySessionId(sessionId) {
      const conversation = await repository.findBySessionId(sessionId);
      return conversation ? format(conversation) : null;
    },

    async addMessage(id, role, content) {
      const exists = await repository.exists(id);
      if (!exists) throw new ConversationNotFoundError(id);

      const message = await repository.addMessage(id, { role, content });
      return {
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      };
    },

    async updateStatus(id, status) {
      const exists = await repository.exists(id);
      if (!exists) throw new ConversationNotFoundError(id);
      await repository.updateStatus(id, status);
    },

    async delete(id) {
      const exists = await repository.exists(id);
      if (!exists) throw new ConversationNotFoundError(id);
      await repository.delete(id);
    },

    async deleteBySessionId(sessionId) {
      await repository.deleteBySessionId(sessionId);
    },
  };
}
