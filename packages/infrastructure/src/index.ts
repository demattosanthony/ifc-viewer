/**
 * @ifc-viewer/infrastructure
 *
 * Infrastructure layer for the IFC Viewer platform.
 * Provides repositories, storage adapters, compute providers, and AI adapters.
 *
 * ## Architecture
 *
 * - database/   - Database repositories (SQLite, Postgres, Memory)
 * - storage/    - Storage adapters (Local, S3, Memory)
 * - compute/    - Compute providers (Local)
 * - ai/         - AI providers (Anthropic)
 *
 * ## Usage
 *
 * ```ts
 * import {
 *   createDatabase,
 *   createStorage,
 *   createLocalComputer,
 *   createAIProvider
 * } from '@ifc-viewer/infrastructure';
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
 *
 * // AI
 * const ai = createAIProvider({
 *   type: 'anthropic',
 *   model: 'claude-sonnet-4-5',
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
  // Local
  createLocalComputer,
  LocalComputer,
  LocalFileSystem,
  LocalShell,
  // Docker
  createDockerComputer,
  DockerComputer,
  DockerFileSystem,
  DockerShell,
  type DockerComputeConfig,
} from "./compute"

// AI
export {
  createAIProvider,
  createAIProviderFromEnv,
  createAnthropicProvider,
  type AIConfig,
  type AIProviderType,
  type AnthropicProviderConfig,
  // Tools (for custom agent implementations)
  createFileTools,
  createShellTools,
  // Prompts
  BIM_IDE_SYSTEM_PROMPT,
  // Utilities
  getErrorMessage,
  formatUsageStats,
} from "./ai"

// Re-export port types for convenience
export type {
  Database,
  Storage,
  Computer,
  AIProvider,
  ProjectRepository,
  WorkspaceRepository,
  ConversationRepository,
  MessageRepository,
} from "@ifc-viewer/core"
