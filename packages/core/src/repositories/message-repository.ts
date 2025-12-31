import type { Message } from "../entities/message";
import type { CreateMessageInput } from "./types";

/**
 * Repository interface for Message entity persistence
 */
export interface MessageRepository {
  /**
   * Create a new message
   */
  create(input: CreateMessageInput): Promise<Message>;

  /**
   * Find a message by ID
   */
  findById(id: string): Promise<Message | null>;

  /**
   * Find all messages for a conversation
   */
  findByConversationId(conversationId: string): Promise<Message[]>;

  /**
   * Delete a message by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all messages for a conversation
   */
  deleteByConversationId(conversationId: string): Promise<void>;
}
