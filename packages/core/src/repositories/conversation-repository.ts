import type { Conversation } from "../entities/conversation";
import type { CreateConversationInput, UpdateConversationInput } from "./types";

/**
 * Repository interface for Conversation entity persistence
 */
export interface ConversationRepository {
  create(input: CreateConversationInput): Promise<Conversation>;
  findActiveByWorkspaceId(workspaceId: string): Promise<Conversation | null>;
  update(id: string, input: UpdateConversationInput): Promise<Conversation>;
  deleteByWorkspaceId(workspaceId: string): Promise<void>;
}
