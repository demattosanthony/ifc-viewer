/**
 * Database Contract
 *
 * Defines repository interfaces for domain entity persistence.
 * Implementations: SQLite, memory
 */

import type { Project } from "../domain/project"
import type { Workspace } from "../domain/workspace"
import type { Conversation } from "../domain/conversation"
import type { Message } from "../domain/message"

export namespace Database {
  /** Project repository contract */
  export type ProjectRepository = {
    create(input: Project.CreateInput): Promise<Project.Entity>
    findById(id: string): Promise<Project.Entity | null>
    findAll(): Promise<Project.Entity[]>
    update(id: string, input: Project.UpdateInput): Promise<Project.Entity>
    delete(id: string): Promise<void>
  }

  /** Workspace repository contract */
  export type WorkspaceRepository = {
    create(input: Workspace.CreateInput): Promise<Workspace.Entity>
    findById(id: string): Promise<Workspace.Entity | null>
    findAll(): Promise<Workspace.Entity[]>
    findByProjectId(projectId: string): Promise<Workspace.Entity[]>
    findActive(): Promise<Workspace.Entity[]>
    update(id: string, input: Workspace.UpdateInput): Promise<Workspace.Entity>
    delete(id: string): Promise<void>
    touch(id: string): Promise<Workspace.Entity>
  }

  /** Conversation repository contract */
  export type ConversationRepository = {
    create(input: Conversation.CreateInput): Promise<Conversation.Entity>
    findActiveByWorkspaceId(workspaceId: string): Promise<Conversation.Entity | null>
    update(id: string, input: Conversation.UpdateInput): Promise<Conversation.Entity>
    deleteByWorkspaceId(workspaceId: string): Promise<void>
  }

  /** Message repository contract */
  export type MessageRepository = {
    create(input: Message.CreateInput): Promise<Message.Entity>
    findByConversationId(conversationId: string): Promise<Message.Entity[]>
  }

  /** Database provider interface */
  export type Provider = {
    projects: ProjectRepository
    workspaces: WorkspaceRepository
    conversations: ConversationRepository
    messages: MessageRepository
    dispose(): Promise<void>
  }
}
