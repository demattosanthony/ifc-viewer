/**
 * Ports
 *
 * Infrastructure interfaces that define how the domain interacts with
 * external systems (database, storage, compute, AI).
 */

// AI
export type {
  AIApproveToolMessage,
  AIChatMessage,
  AIChatOptions,
  // Client messages
  AIClientMessage,
  AIEditorCursorEvent,
  AIEditorDeleteEvent,
  AIEditorInsertEvent,
  AIEditorOpenEvent,
  AIEditorReplaceEvent,
  AIEditorSaveEvent,
  AIErrorEvent,
  // Events
  AIEvent,
  AIFileCreatedEvent,
  AIFileDeletedEvent,
  AIFinishEvent,
  AIMessage,
  AIMessageContent,
  AIMessageTextPart,
  AIMessageToolCallPart,
  AIMessageToolResultPart,
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
  TerminalClientMessage,
  TerminalDataEvent,
  TerminalErrorEvent,
  TerminalExitEvent,
  TerminalInputMessage,
  TerminalReadyEvent,
  TerminalResizeMessage,
  // Terminal WebSocket events
  TerminalServerEvent,
} from "./ai.port"
// Compute
export type {
  ComputeConfig,
  Computer,
  FileContent,
  FileEntry,
  FileReadOptions,
  FileStat,
  FileSystem,
  PythonTerminalOptions,
  Shell,
  TerminalOptions,
  TerminalSession,
} from "./compute.port"
// Database
export type {
  ConversationRepository,
  Database,
  MessagePartRepository,
  MessageRepository,
  ModelRepository,
  ProjectRepository,
  UnitOfWork,
} from "./database.port"
// Storage
export type {
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
} from "./storage.port"
// Stream Store
export type { Stream, StreamEvent, StreamStatus, StreamStore } from "./stream-store.port"
