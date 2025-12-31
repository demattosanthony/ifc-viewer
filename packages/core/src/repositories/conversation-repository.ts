import type {
  Conversation,
  ConversationMessage,
  ConversationStatus,
  CreateConversationInput,
  AddMessageInput,
} from "../entities/conversation";

/**
 * Repository interface for conversation management
 * Implementations can use different storage backends (memory, postgres, etc.)
 */
export interface ConversationRepository {
  /**
   * Create a new conversation
   */
  create(input: CreateConversationInput): Promise<Conversation>;

  /**
   * Find a conversation by ID
   * @returns The conversation or null if not found
   */
  findById(id: string): Promise<Conversation | null>;

  /**
   * Find conversation by session ID
   * Returns the active conversation for a session, if any
   */
  findBySessionId(sessionId: string): Promise<Conversation | null>;

  /**
   * Find all conversations for a session
   */
  findAllBySessionId(sessionId: string): Promise<Conversation[]>;

  /**
   * Add a message to a conversation
   * @returns The created message
   */
  addMessage(
    conversationId: string,
    input: AddMessageInput
  ): Promise<ConversationMessage>;

  /**
   * Update conversation status
   */
  updateStatus(id: string, status: ConversationStatus): Promise<void>;

  /**
   * Delete a conversation by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all conversations for a session
   * Used when a session expires or is deleted
   */
  deleteBySessionId(sessionId: string): Promise<void>;

  /**
   * Check if a conversation exists
   */
  exists(id: string): Promise<boolean>;
}
