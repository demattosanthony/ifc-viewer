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

// Re-export port types for convenience
export type {
  AIProvider,
  Computer,
  ConversationRepository,
  Database,
  IFCProcessor,
  MessageRepository,
  ProjectRepository,
  Storage,
  Stream,
  StreamEvent,
  StreamStatus,
  StreamStore,
} from "@ifc-viewer/core"
// AI
export {
  type AIConfig,
  type AIProviderType,
  type AnthropicProviderConfig,
  // Prompts
  BIM_IDE_SYSTEM_PROMPT,
  createAIProvider,
  createAIProviderFromEnv,
  createAnthropicProvider,
  // Tools (for custom agent implementations)
  createFileTools,
  createShellTools,
  formatUsageStats,
  // Utilities
  getErrorMessage,
} from "./ai"

// Compute
export {
  // Docker
  createDockerComputer,
  // Local
  createLocalComputer,
  type DockerComputeConfig,
  DockerComputer,
  DockerFileSystem,
  DockerShell,
  LocalComputer,
  LocalFileSystem,
  LocalShell,
} from "./compute"
// Database
export {
  createDatabase,
  type DatabaseConfig,
  type MemoryDatabaseConfig,
  type PostgresDatabaseConfig,
  type SQLiteDatabaseConfig,
} from "./database"
// IFC Processor
export { createThatOpenIFCProcessor } from "./ifc-processor"
// Skills
export {
  createFileSystemSkillsProvider,
  createSkillsProvider,
  FileSystemSkillsProvider,
  SKILL_FILENAME,
  SKILLS_PATH,
  type SkillsConfig,
  type SkillsProviderType,
} from "./skills"
// Storage
export {
  // Utilities
  BaseStorageObject,
  createStorage,
  createStorageFromEnv,
  createStorageProvider,
  createStorageProviderFromEnv,
  inferContentType,
  isBinaryExtension,
  LocalStorage,
  type LocalStorageConfig,
  MemoryStorage,
  S3Storage,
  type S3StorageConfig,
  type StorageConfig,
  streamToBytes,
  toBytes,
} from "./storage"
// Streams
export { createMemoryStreamStore, type MemoryStreamStoreConfig } from "./streams"
