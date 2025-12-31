/**
 * Conversation entity - represents an AI chat session within a workspace
 *
 * Conversations belong to Workspaces and contain Messages.
 * Messages are now stored separately via MessageRepository.
 */
export type ConversationStatus = "active" | "streaming" | "completed" | "aborted";

export interface Conversation {
  /** Unique identifier */
  readonly id: string;

  /** Reference to the parent Workspace */
  readonly workspaceId: string;

  /** Current status of the conversation */
  readonly status: ConversationStatus;

  /** When the conversation was created */
  readonly createdAt: Date;

  /** When the conversation was last updated */
  readonly updatedAt: Date;
}

/**
 * Create a new Conversation entity
 */
export function createConversation(params: {
  id: string;
  workspaceId: string;
  status?: ConversationStatus;
  createdAt?: Date;
  updatedAt?: Date;
}): Conversation {
  const now = new Date();
  return {
    id: params.id,
    workspaceId: params.workspaceId,
    status: params.status ?? "active",
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
  };
}
