/**
 * @ifc-viewer/infrastructure
 *
 * Infrastructure layer for the IFC Viewer platform.
 * Provides repositories, storage adapters, and compute providers.
 *
 * ## Architecture
 *
 * - database/   - Database repositories (SQLite, Postgres, Memory)
 * - storage/    - Storage adapters (Local, S3, Memory)
 * - compute/    - Compute providers (Local)
 *
 * ## Usage
 *
 * ```ts
 * import { createDatabase, createStorage, createLocalComputer } from '@ifc-viewer/infrastructure';
 *
 * // Database
 * const db = await createDatabase({
 *   type: 'sqlite',
 *   dataDirectory: './data',
 * });
 *
 * // Storage
 * const storage = createStorage({
 *   type: 'local',
 *   baseDir: './data/storage',
 * });
 *
 * // Compute
 * const compute = await createLocalComputer({
 *   workingDirectory: './workspace',
 * });
 * ```
 */

// Database
export {
  createDatabase,
  type DatabaseConfig,
  type SQLiteDatabaseConfig,
  type MemoryDatabaseConfig,
  type PostgresDatabaseConfig,
} from "./database"

// Storage
export {
  createStorage,
  createStorageFromEnv,
  createStorageProvider,
  createStorageProviderFromEnv,
  type StorageConfig,
  LocalStorage,
  type LocalStorageConfig,
  MemoryStorage,
  S3Storage,
  type S3StorageConfig,
  // Utilities
  BaseStorageObject,
  toBytes,
  streamToBytes,
  inferContentType,
} from "./storage"

// Compute
export {
  createLocalComputer,
  LocalComputer,
  LocalFileSystem,
  LocalShell,
} from "./compute"

// Re-export port types for convenience
export type {
  Database,
  Storage,
  Computer,
  ProjectRepository,
  WorkspaceRepository,
  ConversationRepository,
  MessageRepository,
} from "@ifc-viewer/core"
