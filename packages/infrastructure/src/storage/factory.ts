/**
 * Storage Factory
 *
 * Creates storage instances from configuration objects.
 */

import type { Storage } from "@ifc-viewer/core"
import { LocalStorage, type LocalStorageConfig } from "./local"
import { MemoryStorage } from "./memory"
import { S3Storage, type S3StorageConfig } from "./s3"

/**
 * Configuration for creating a storage instance.
 */
export type StorageConfig =
  | ({ type: "local" } & LocalStorageConfig)
  | { type: "memory" }
  | ({ type: "s3" } & S3StorageConfig)

/**
 * Create a storage instance from configuration.
 *
 * @example
 * ```ts
 * // Local filesystem storage
 * const local = createStorage({
 *   type: 'local',
 *   baseDir: '/tmp/storage',
 * });
 *
 * // In-memory storage (for testing)
 * const memory = createStorage({ type: 'memory' });
 *
 * // S3-compatible storage
 * const s3 = createStorage({
 *   type: 's3',
 *   bucket: 'my-bucket',
 *   endpoint: 'https://s3.amazonaws.com',
 * });
 * ```
 */
export function createStorage(config: StorageConfig): Storage {
  switch (config.type) {
    case "local":
      return new LocalStorage(config)

    case "memory":
      return new MemoryStorage()

    case "s3":
      return new S3Storage(config)

    default:
      throw new Error(
        `Unknown storage type: ${(config as { type: string }).type}`
      )
  }
}

/**
 * Create a storage instance from environment variables.
 *
 * Environment variables:
 * - STORAGE_TYPE: 'local' | 'memory' | 's3' (default: 'local')
 *
 * For local:
 * - STORAGE_LOCAL_BASE_DIR: Base directory path (required)
 * - STORAGE_LOCAL_URL_MODE: 'none' | 'data' (default: 'none')
 *
 * For S3:
 * - STORAGE_S3_BUCKET: Bucket name (required)
 * - STORAGE_S3_ENDPOINT: S3 endpoint URL (optional)
 * - STORAGE_S3_REGION: AWS region (optional)
 * - STORAGE_S3_PREFIX: Key prefix (optional)
 * - S3_ACCESS_KEY_ID: Access key (optional, falls back to AWS SDK defaults)
 * - S3_SECRET_ACCESS_KEY: Secret key (optional, falls back to AWS SDK defaults)
 */
export function createStorageFromEnv(): Storage {
  const type = process.env.STORAGE_TYPE || "local"

  switch (type) {
    case "local": {
      const baseDir = process.env.STORAGE_LOCAL_BASE_DIR
      if (!baseDir) {
        throw new Error(
          "STORAGE_LOCAL_BASE_DIR environment variable is required for local storage"
        )
      }
      const urlMode = process.env.STORAGE_LOCAL_URL_MODE as "none" | "data" | undefined
      return new LocalStorage({ baseDir, urlMode })
    }

    case "memory":
      return new MemoryStorage()

    case "s3": {
      const bucket = process.env.STORAGE_S3_BUCKET
      if (!bucket) {
        throw new Error(
          "STORAGE_S3_BUCKET environment variable is required for S3 storage"
        )
      }
      return new S3Storage({
        bucket,
        endpoint: process.env.STORAGE_S3_ENDPOINT,
        region: process.env.STORAGE_S3_REGION,
        prefix: process.env.STORAGE_S3_PREFIX,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      })
    }

    default:
      throw new Error(`Unknown STORAGE_TYPE: ${type}`)
  }
}

// Backwards compatibility aliases
export const createStorageProvider = createStorage
export const createStorageProviderFromEnv = createStorageFromEnv
