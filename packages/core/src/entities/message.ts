/**
 * Message entity - represents a single chat message in a conversation
 *
 * Messages are now a separate entity rather than embedded in Conversation.
 */
export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  /** Unique identifier */
  readonly id: string;

  /** Reference to the parent Conversation */
  readonly conversationId: string;

  /** Role of the message sender */
  readonly role: MessageRole;

  /** Message content */
  readonly content: string;

  /** When the message was created */
  readonly createdAt: Date;
}

/**
 * Create a new Message entity
 */
export function createMessage(params: {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt?: Date;
}): Message {
  return {
    id: params.id,
    conversationId: params.conversationId,
    role: params.role,
    content: params.content,
    createdAt: params.createdAt ?? new Date(),
  };
}
