/**
 * Database Port
 *
 * Defines repository interfaces for domain entity persistence.
 * Implementations: SQLite, Postgres, memory
 */

import type { Project, Workspace, Conversation, Message } from "../domain"

// ============================================================================
// Repository Interfaces
// ============================================================================

/** Project repository interface */
export interface ProjectRepository {
  create(input: Project.CreateInput): Promise<Project>
  findById(id: string): Promise<Project | null>
  findAll(): Promise<Project[]>
  update(id: string, input: Project.UpdateInput): Promise<Project>
  delete(id: string): Promise<void>
}

/** Workspace repository interface */
export interface WorkspaceRepository {
  create(input: Workspace.CreateInput): Promise<Workspace>
  findById(id: string): Promise<Workspace | null>
  findAll(): Promise<Workspace[]>
  findByProjectId(projectId: string): Promise<Workspace[]>
  findActive(): Promise<Workspace[]>
  update(id: string, input: Workspace.UpdateInput): Promise<Workspace>
  delete(id: string): Promise<void>
  touch(id: string): Promise<Workspace>
}

/** Conversation repository interface */
export interface ConversationRepository {
  create(input: Conversation.CreateInput): Promise<Conversation>
  findActiveByWorkspaceId(workspaceId: string): Promise<Conversation | null>
  update(id: string, input: Conversation.UpdateInput): Promise<Conversation>
  deleteByWorkspaceId(workspaceId: string): Promise<void>
}

/** Message repository interface */
export interface MessageRepository {
  create(input: Message.CreateInput): Promise<Message>
  findByConversationId(conversationId: string): Promise<Message[]>
}

// ============================================================================
// Database Provider
// ============================================================================

/** Database provider interface - aggregates all repositories */
export interface Database {
  projects: ProjectRepository
  workspaces: WorkspaceRepository
  conversations: ConversationRepository
  messages: MessageRepository
  dispose(): Promise<void>
}
