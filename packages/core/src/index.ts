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
 *                      -> Model (IFC file metadata)
 *
 * Compute is ephemeral - created on-demand when AI chat starts,
 * disposed after 5 minutes of inactivity.
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

// Context - Dependency Injection
export {
  type ComputeFactory,
  type Context,
  type ContextConfig,
  createContext,
  withContext,
} from "./context"
// Domain Layer - Agent Types
export type {
  AgentMessage,
  AgentMessageRole,
  MessagePart,
  Position,
  Range,
  TextPart,
  ToolInvocation,
  ToolInvocationState,
  ToolPart,
  UsageStats,
} from "./domain"
// Domain Layer - Entities
export {
  // Conversation
  type Conversation,
  ConversationSchema,
  type ConversationStatus,
  ConversationStatusSchema,
  createProject,
  getModelStorageKey,
  inferDiscipline,
  isAssistantMessage,
  isConversationActive,
  isSystemMessage,
  isUserMessage,
  isValidProjectId,
  // Message
  type Message,
  type MessageRole,
  MessageRoleSchema,
  MessageSchema,
  // Model
  type Model,
  type ModelDiscipline,
  ModelDisciplineSchema,
  ModelSchema,
  // Project
  type Project,
  ProjectSchema,
} from "./domain"
// Domain Layer - Errors
export {
  DomainError,
  DuplicateError,
  InvalidProjectIdError,
  isDomainError,
  NotFoundError,
  ValidationError,
} from "./domain/errors"
// Domain Layer - Value Objects
export { Slug } from "./domain/value-objects"
// Ports - Infrastructure Interfaces
export type {
  AIApproveToolMessage,
  AIChatMessage,
  AIChatOptions,
  AIClientMessage,
  AIEditorCursorEvent,
  AIEditorDeleteEvent,
  AIEditorInsertEvent,
  AIEditorOpenEvent,
  AIEditorReplaceEvent,
  AIEditorSaveEvent,
  AIErrorEvent,
  AIEvent,
  AIFileCreatedEvent,
  AIFileDeletedEvent,
  AIFinishEvent,
  AIMessage,
  // AI
  AIProvider,
  AIProviderConfig,
  AIReadyEvent,
  AIRejectToolMessage,
  AIReplayEndEvent,
  AIReplayStartEvent,
  AIStepEndEvent,
  AIStepStartEvent,
  AIStopMessage,
  AIStreamStartEvent,
  AITerminalAppendEvent,
  AITerminalExecuteEvent,
  AITerminalFocusEvent,
  AITerminalOutputEvent,
  AITerminalTypeEvent,
  AITextDeltaEvent,
  AIToolCallEvent,
  AIToolInputDeltaEvent,
  AIToolInputEndEvent,
  AIToolInputStartEvent,
  AIToolNeedsApprovalEvent,
  AIToolResultEvent,
  AIUsageStats,
  ComputeConfig,
  // Compute
  Computer,
  ConversationRepository,
  // Database
  Database,
  FileContent,
  FileEntry,
  FileReadOptions,
  FileStat,
  FileSystem,
  MessageRepository,
  ModelRepository,
  ProjectRepository,
  PythonTerminalOptions,
  Shell,
  // Storage
  Storage,
  StorageEntry,
  StorageInput,
  StorageListOptions,
  StorageMetadata,
  StorageObject,
  StoragePutOptions,
  StoragePutResult,
  StorageUploadCredentials,
  StorageUploadUrlOptions,
  StorageUrlOptions,
  Stream,
  StreamEvent,
  StreamStatus,
  // Stream Store
  StreamStore,
  TerminalClientMessage,
  TerminalDataEvent,
  TerminalErrorEvent,
  TerminalExitEvent,
  TerminalInputMessage,
  TerminalOptions,
  TerminalReadyEvent,
  TerminalResizeMessage,
  // Terminal WebSocket events (internal - used by compute system)
  TerminalServerEvent,
  TerminalSession,
  UnitOfWork,
} from "./ports"
// Application Services
export {
  type AgentChatInput,
  type AgentChatResult,
  type ChangeSource,
  type ChangeTracker,
  type ChangeType,
  type CreateChangeTrackerOptions,
  type CreateProjectInput,
  // Change tracking
  createChangeTracker,
  // Project
  createProjectWithStorage,
  deleteModel,
  deleteProjectModels,
  type FileChange,
  type FileSnapshot,
  getModelWithData,
  listProjectModels,
  // Agent
  runAgentChat,
  type UpdateModelInput,
  type UploadModelInput,
  updateModel,
  // Model
  uploadModel,
} from "./services"
// Utilities
export {
  buildStorageKey,
  deleteStoragePrefix,
  generateId,
  isBinaryExtension,
  normalizeStoragePath,
} from "./utils"
