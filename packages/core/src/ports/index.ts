/**
 * Ports
 *
 * Infrastructure interfaces that define how the domain interacts with
 * external systems (database, storage, compute).
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
