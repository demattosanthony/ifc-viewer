import type { Message } from "../entities/message";
import type { MessageRepository } from "../repositories/message-repository";
import type { CreateMessageInput } from "../repositories/types";
import { MessageNotFoundError } from "../errors";
import type { MessageOutput } from "./types";

export interface MessagesClient {
  create(input: CreateMessageInput): Promise<MessageOutput>;
  get(id: string): Promise<MessageOutput | null>;
  getOrThrow(id: string): Promise<MessageOutput>;
  listByConversation(conversationId: string): Promise<MessageOutput[]>;
  delete(id: string): Promise<void>;
  deleteByConversation(conversationId: string): Promise<void>;
}

export interface MessagesClientConfig {
  repository: MessageRepository;
}

/**
 * Format a Message entity to a MessageOutput DTO
 */
function formatMessage(message: Message): MessageOutput {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export function createMessagesClient(config: MessagesClientConfig): MessagesClient {
  const { repository } = config;

  return {
    async create(input) {
      const message = await repository.create(input);
      return formatMessage(message);
    },

    async get(id) {
      const message = await repository.findById(id);
      return message ? formatMessage(message) : null;
    },

    async getOrThrow(id) {
      const message = await repository.findById(id);
      if (!message) throw new MessageNotFoundError(id);
      return formatMessage(message);
    },

    async listByConversation(conversationId) {
      const messages = await repository.findByConversationId(conversationId);
      return messages.map(formatMessage);
    },

    async delete(id) {
      const message = await repository.findById(id);
      if (!message) throw new MessageNotFoundError(id);
      await repository.delete(id);
    },

    async deleteByConversation(conversationId) {
      await repository.deleteByConversationId(conversationId);
    },
  };
}
