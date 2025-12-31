import type { WorkspaceStatus } from "../entities/workspace";
import type { ConversationStatus } from "../entities/conversation";
import type { MessageRole } from "../entities/message";

// Project input types
export interface CreateProjectInput {
  name: string;
  description?: string | null;
  defaultBranch?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  defaultBranch?: string;
}

// Workspace input types
export interface CreateWorkspaceInput {
  projectId: string;
  branch?: string;
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
