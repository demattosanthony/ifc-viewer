/**
 * Storage Adapters
 *
 * Provides local, memory, and S3-compatible storage implementations.
 */

// Re-export Storage types from core
export type { Storage, StorageObject, StorageMetadata, StorageEntry } from "@ifc-viewer/core"

// Base utilities
export { BaseStorageObject, toBytes, streamToBytes, inferContentType } from "./base"

// Implementations
export { LocalStorage, type LocalStorageConfig } from "./local"
export { MemoryStorage } from "./memory"
export { S3Storage, type S3StorageConfig } from "./s3"

// Factory
export {
  createStorage,
  createStorageFromEnv,
  // Backwards compatibility
  createStorageProvider,
  createStorageProviderFromEnv,
  type StorageConfig,
} from "./factory"
