import type { ProjectRepository } from "../repositories/project-repository";
import type { WorkspaceRepository } from "../repositories/workspace-repository";
import type { ConversationRepository } from "../repositories/conversation-repository";
import type { MessageRepository } from "../repositories/message-repository";
import type { WorkspaceStatus } from "../entities/workspace";
import type { ConversationStatus } from "../entities/conversation";
import type { MessageRole } from "../entities/message";

// ============================================================================
// Repository Provider - interface that DatabaseProvider satisfies
// ============================================================================

export interface RepositoryProvider {
  projects: ProjectRepository;
  workspaces: WorkspaceRepository;
  conversations: ConversationRepository;
  messages: MessageRepository;
}

// ============================================================================
// Configuration
// ============================================================================

export interface IFCViewerClientConfig {
  db: RepositoryProvider;
}

// ============================================================================
// Output DTOs
// ============================================================================

export interface ProjectOutput {
  id: string;
  name: string;
  description: string | null;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceOutput {
  id: string;
  projectId: string;
  branch: string;
  status: WorkspaceStatus;
  createdAt: string;
  lastAccessedAt: string;
}

export interface ConversationOutput {
  id: string;
  workspaceId: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MessageOutput {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}
