import type { Conversation } from "../entities/conversation";
import type { CreateConversationInput, UpdateConversationInput } from "./types";

/**
 * Repository interface for Conversation entity persistence
 */
export interface ConversationRepository {
  /**
   * Create a new conversation
   */
  create(input: CreateConversationInput): Promise<Conversation>;

  /**
   * Find a conversation by ID
   */
  findById(id: string): Promise<Conversation | null>;

  /**
   * Find all conversations for a workspace
   */
  findByWorkspaceId(workspaceId: string): Promise<Conversation[]>;

  /**
   * Find the active conversation for a workspace (if any)
   */
  findActiveByWorkspaceId(workspaceId: string): Promise<Conversation | null>;

  /**
   * Update a conversation
   */
  update(id: string, input: UpdateConversationInput): Promise<Conversation>;

  /**
   * Delete a conversation by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all conversations for a workspace
   */
  deleteByWorkspaceId(workspaceId: string): Promise<void>;

  /**
   * Check if a conversation exists
   */
  exists(id: string): Promise<boolean>;
}
