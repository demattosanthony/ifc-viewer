/**
 * Database Port
 *
 * Defines repository interfaces for domain entity persistence.
 * Implementations: SQLite, Postgres, memory
 */

import type { Conversation, Message, MessagePart, Model, Project } from "../domain"

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

/** Conversation repository interface */
export interface ConversationRepository {
  create(input: Conversation.CreateInput): Promise<Conversation>
  findById(id: string): Promise<Conversation | null>
  findByProjectId(projectId: string): Promise<Conversation[]>
  update(id: string, input: Conversation.UpdateInput): Promise<Conversation>
  delete(id: string): Promise<void>
  deleteByProjectId(projectId: string): Promise<void>
}

/** Message repository interface */
export interface MessageRepository {
  create(input: Message.CreateInput): Promise<Message>
  findByConversationId(conversationId: string): Promise<Message[]>
}

/** Message part repository interface */
export interface MessagePartRepository {
  createMany(messageId: string, parts: MessagePart[]): Promise<void>
  findByMessageId(messageId: string): Promise<MessagePart[]>
  findByMessageIds(messageIds: string[]): Promise<Map<string, MessagePart[]>>
}

/** Model repository interface */
export interface ModelRepository {
  create(input: Model.CreateInput): Promise<Model>
  findById(id: string): Promise<Model | null>
  findByProjectId(projectId: string): Promise<Model[]>
  findByFilePath(projectId: string, filePath: string): Promise<Model | null>
  update(id: string, input: Model.UpdateInput): Promise<Model>
  delete(id: string): Promise<void>
  deleteByProjectId(projectId: string): Promise<void>
}

// ============================================================================
// Unit of Work
// ============================================================================

/**
 * Unit of Work interface - provides access to repositories within a transaction.
 * All operations performed through these repositories will be part of the same transaction.
 */
export interface UnitOfWork {
  projects: ProjectRepository
  conversations: ConversationRepository
  messages: MessageRepository
  messageParts: MessagePartRepository
  models: ModelRepository
}

// ============================================================================
// Database Provider
// ============================================================================

/** Database provider interface - aggregates all repositories */
export interface Database extends UnitOfWork {
  /**
   * Execute operations within a database transaction.
   *
   * All repository operations performed within the callback will be atomic -
   * either all succeed or all are rolled back on error.
   *
   * @param fn - Callback function that receives a UnitOfWork with transaction-scoped repositories
   * @returns The result of the callback function
   * @throws Re-throws any error from the callback after rolling back the transaction
   *
   * @example
   * ```ts
   * const result = await db.transaction(async (uow) => {
   *   const conversation = await uow.conversations.create({ projectId })
   *   await uow.messages.create({ conversationId: conversation.id, role: "user", content })
   *   return conversation
   * })
   * ```
   */
  transaction<T>(fn: (uow: UnitOfWork) => Promise<T>): Promise<T>

  dispose(): Promise<void>
}
