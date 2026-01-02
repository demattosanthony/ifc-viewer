/**
 * Ports
 *
 * Infrastructure interfaces that define how the domain interacts with
 * external systems (database, storage, compute, AI).
 */

// Database
export type {
  Database,
  ProjectRepository,
  WorkspaceRepository,
  ConversationRepository,
  MessageRepository,
} from "./database.port"

// Storage
export type {
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
} from "./storage.port"

// Compute
export type {
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
} from "./compute.port"

// AI
export type {
  AIProvider,
  AIProviderConfig,
  AIChatOptions,
  AIMessage,
  AIUsageStats,
  // Events
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
  // Client messages
  AIClientMessage,
  AIChatMessage,
  AIStopMessage,
  AIApproveToolMessage,
  AIRejectToolMessage,
} from "./ai.port"
