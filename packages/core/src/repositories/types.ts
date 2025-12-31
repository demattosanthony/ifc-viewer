import type { WorkspaceStatus } from "../entities/workspace";
import type { ConversationStatus } from "../entities/conversation";
import type { MessageRole } from "../entities/message";

// Project input types
export interface CreateProjectInput {
  id: string; // Slug (e.g., "sample-project")
  description?: string | null;
}

export interface UpdateProjectInput {
  description?: string | null;
}

// Workspace input types
export interface CreateWorkspaceInput {
  projectId: string;
}

export interface UpdateWorkspaceInput {
  status?: WorkspaceStatus;
  lastAccessedAt?: Date;
}

// Conversation input types
export interface CreateConversationInput {
  workspaceId: string;
}

export interface UpdateConversationInput {
  status?: ConversationStatus;
}

// Message input types
export interface CreateMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
}
