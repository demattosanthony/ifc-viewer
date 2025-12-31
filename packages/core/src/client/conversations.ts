import type { Conversation } from "../entities/conversation";
import type { ConversationRepository } from "../repositories/conversation-repository";
import type { CreateConversationInput, UpdateConversationInput } from "../repositories/types";
import { ConversationNotFoundError } from "../errors";
import type { ConversationOutput } from "./types";

export interface ConversationsClient {
  create(input: CreateConversationInput): Promise<ConversationOutput>;
  get(id: string): Promise<ConversationOutput | null>;
  getOrThrow(id: string): Promise<ConversationOutput>;
  getActiveByWorkspace(workspaceId: string): Promise<ConversationOutput | null>;
  listByWorkspace(workspaceId: string): Promise<ConversationOutput[]>;
  update(id: string, input: UpdateConversationInput): Promise<ConversationOutput>;
  delete(id: string): Promise<void>;
  deleteByWorkspace(workspaceId: string): Promise<void>;
}

export interface ConversationsClientConfig {
  repository: ConversationRepository;
}

/**
 * Format a Conversation entity to a ConversationOutput DTO
 */
function formatConversation(conversation: Conversation): ConversationOutput {
  return {
    id: conversation.id,
    workspaceId: conversation.workspaceId,
    status: conversation.status,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export function createConversationsClient(config: ConversationsClientConfig): ConversationsClient {
  const { repository } = config;

  return {
    async create(input) {
      const conversation = await repository.create(input);
      return formatConversation(conversation);
    },

    async get(id) {
      const conversation = await repository.findById(id);
      return conversation ? formatConversation(conversation) : null;
    },

    async getOrThrow(id) {
      const conversation = await repository.findById(id);
      if (!conversation) throw new ConversationNotFoundError(id);
      return formatConversation(conversation);
    },

    async getActiveByWorkspace(workspaceId) {
      const conversation = await repository.findActiveByWorkspaceId(workspaceId);
      return conversation ? formatConversation(conversation) : null;
    },

    async listByWorkspace(workspaceId) {
      const conversations = await repository.findByWorkspaceId(workspaceId);
      return conversations.map(formatConversation);
    },

    async update(id, input) {
      const exists = await repository.exists(id);
      if (!exists) throw new ConversationNotFoundError(id);
      const conversation = await repository.update(id, input);
      return formatConversation(conversation);
    },

    async delete(id) {
      const exists = await repository.exists(id);
      if (!exists) throw new ConversationNotFoundError(id);
      await repository.delete(id);
    },

    async deleteByWorkspace(workspaceId) {
      await repository.deleteByWorkspaceId(workspaceId);
    },
  };
}
