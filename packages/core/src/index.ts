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
 * Project (persistent) -> Conversation -> Message
 *                      -> Workspace (ephemeral compute)
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

// Domain Layer - Agent Types
export type {
  Position,
  Range,
  UsageStats,
  TextPart,
  ToolInvocationState,
  ToolInvocation,
  ToolPart,
  MessagePart,
  AgentMessageRole,
  AgentMessage,
} from "./domain"

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
  getWorkspaceWithCompute,
  stopWorkspaceWithSync,
  deleteWorkspace,
  runAgentChat,
  // Storage sync utilities
  normalizeStoragePath,
  buildStorageKey,
  deleteStoragePrefix,
  createStorageSyncCallbacks,
  type CreateProjectInput,
  type CreateWorkspaceInput,
  type AgentChatInput,
  type AgentChatResult,
  type StorageSyncOptions,
  type StorageSyncCallbacks,
} from "./services"

// Ports - Infrastructure Interfaces
export type {
  // Database
  Database,
  UnitOfWork,
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
  // AI
  AIProvider,
  AIProviderConfig,
  AIChatOptions,
  AIMessage,
  AIUsageStats,
  AIEvent,
  AIReadyEvent,
  AITextDeltaEvent,
  AIStepStartEvent,
  AIStepEndEvent,
  AIFinishEvent,
  AIErrorEvent,
  AIToolInputStartEvent,
  AIToolInputDeltaEvent,
  AIToolInputEndEvent,
  AIToolCallEvent,
  AIToolResultEvent,
  AIToolNeedsApprovalEvent,
  AIEditorOpenEvent,
  AIEditorCursorEvent,
  AIEditorInsertEvent,
  AIEditorDeleteEvent,
  AIEditorSaveEvent,
  AIEditorReplaceEvent,
  AITerminalFocusEvent,
  AITerminalTypeEvent,
  AITerminalExecuteEvent,
  AITerminalOutputEvent,
  AITerminalAppendEvent,
  AIFileCreatedEvent,
  AIFileDeletedEvent,
  AIClientMessage,
  AIChatMessage,
  AIStopMessage,
  AIApproveToolMessage,
  AIRejectToolMessage,
  // Terminal WebSocket events
  TerminalServerEvent,
  TerminalReadyEvent,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalErrorEvent,
  TerminalClientMessage,
  TerminalInputMessage,
  TerminalResizeMessage,
} from "./ports"

// Context - Dependency Injection
export {
  createContext,
  withContext,
  type Context,
  type ContextConfig,
  type ComputeFactory,
  type OnWorkspaceIdle,
  type ActivitySource,
} from "./context"
