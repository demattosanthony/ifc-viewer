/**
 * @ifc-viewer/core
 *
 * Core domain logic for the IFC Viewer platform.
 *
 * ## Architecture
 *
 * - domain/    - Entities, Value Objects, Domain Errors
 * - services/  - Application services (orchestration with real logic)
 * - ports/     - Infrastructure interfaces
 * - context    - Dependency injection
 *
 * ## Domain Model
 *
 * Project (persistent) -> Workspace (ephemeral) -> Conversation -> Message
 *
 * ## Usage Pattern
 *
 * For simple CRUD operations, call repositories directly via `ctx.db`:
 * ```ts
 * const project = await ctx.db.projects.findById(id)
 * ```
 *
 * For complex operations that need orchestration, use services:
 * ```ts
 * const project = await createProjectWithStorage(ctx, { id: 'my-project' })
 * ```
 */

// Domain Layer - Entities
export {
  // Project
  type Project,
  ProjectSchema,
  createProject,
  isValidProjectId,
  // Workspace
  type Workspace,
  type WorkspaceStatus,
  WorkspaceSchema,
  WorkspaceStatusSchema,
  isWorkspaceActive,
  // Conversation
  type Conversation,
  type ConversationStatus,
  ConversationSchema,
  ConversationStatusSchema,
  isConversationActive,
  // Message
  type Message,
  type MessageRole,
  MessageSchema,
  MessageRoleSchema,
  isUserMessage,
  isAssistantMessage,
  isSystemMessage,
} from "./domain"

// Domain Layer - Value Objects
export { Slug } from "./domain/value-objects"

// Domain Layer - Errors
export {
  DomainError,
  isDomainError,
  NotFoundError,
  DuplicateError,
  ValidationError,
  InvalidProjectIdError,
} from "./domain/errors"

// Application Services
export {
  createProjectWithStorage,
  createWorkspaceWithFiles,
  type CreateProjectInput,
  type CreateWorkspaceInput,
} from "./services"

// Ports - Infrastructure Interfaces
export type {
  // Database
  Database,
  ProjectRepository,
  WorkspaceRepository,
  ConversationRepository,
  MessageRepository,
  // Storage
  Storage,
  StorageInput,
  StorageMetadata,
  StorageObject,
  StorageEntry,
  StoragePutOptions,
  StorageListOptions,
  StorageUrlOptions,
  StorageUploadUrlOptions,
  StorageUploadCredentials,
  StoragePutResult,
  // Compute
  Computer,
  ComputeConfig,
  TerminalSession,
  TerminalOptions,
  FileSystem,
  FileEntry,
  FileStat,
  FileReadOptions,
  FileContent,
  Shell,
} from "./ports"

// Context - Dependency Injection
export { createContext, withContext, type Context, type ContextConfig } from "./context"
