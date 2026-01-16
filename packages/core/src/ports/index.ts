/**
 * Ports
 *
 * Infrastructure interfaces that define how the domain interacts with
 * external systems (database, storage, compute, AI).
 */

// AI
export type {
  AIChatOptions,
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
  AIMessageContent,
  AIMessageTextPart,
  AIMessageToolCallPart,
  AIMessageToolResultPart,
  AIPresenceEvent,
  AIProvider,
  AIProviderConfig,
  AIReadyEvent,
  AIReasoningDeltaEvent,
  AIReasoningEndEvent,
  AIReasoningStartEvent,
  AIReplayEndEvent,
  AIReplayStartEvent,
  AIStepEndEvent,
  AIStepStartEvent,
  AIStreamEvent,
  AIStreamStartEvent,
  AITerminalAppendEvent,
  AITerminalExecuteEvent,
  AITerminalFocusEvent,
  AITerminalOutputEvent,
  AITerminalTypeEvent,
  AITextDeltaEvent,
  AIThinkingConfig,
  AIToolCallEvent,
  AIToolInputDeltaEvent,
  AIToolInputEndEvent,
  AIToolInputStartEvent,
  AIToolNeedsApprovalEvent,
  AIToolResultEvent,
  AIUsageStats,
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
// IFC Processor
export type { IFCProcessor } from "./ifc-processor.port"
// Skills
export type { SkillMetadata, SkillsProvider, SkillsProviderConfig } from "./skills.port"
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
