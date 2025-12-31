/**
 * A single message in a conversation
 */
export interface ConversationMessage {
  /** Unique message identifier */
  id: string;
  /** Message role - user or assistant */
  role: "user" | "assistant";
  /** Message content */
  content: string;
  /** When the message was created */
  createdAt: Date;
}

/**
 * Conversation status
 */
export type ConversationStatus = "active" | "streaming" | "completed" | "aborted";

/**
 * A conversation with an AI agent
 */
export interface Conversation {
  /** Unique conversation identifier */
  id: string;
  /** Session this conversation belongs to */
  sessionId: string;
  /** Messages in the conversation */
  messages: ConversationMessage[];
  /** Current status of the conversation */
  status: ConversationStatus;
  /** When the conversation was created */
  createdAt: Date;
  /** When the conversation was last updated */
  updatedAt: Date;
}

/**
 * Input for creating a new conversation
 */
export interface CreateConversationInput {
  /** Session ID this conversation belongs to */
  sessionId: string;
}

/**
 * Input for adding a message to a conversation
 */
export interface AddMessageInput {
  /** Message role */
  role: "user" | "assistant";
  /** Message content */
  content: string;
}
