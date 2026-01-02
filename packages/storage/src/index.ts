/**
 * Storage Module
 *
 * Provides a pluggable storage abstraction for blob/object storage.
 *
 * @example
 * ```ts
 * import { createStorageProvider } from '@ifc-viewer/storage';
 *
 * // Create a local storage provider
 * const storage = createStorageProvider({
 *   type: 'local',
 *   baseDir: '/tmp/my-storage',
 * });
 *
 * // Store a file
 * await storage.put('documents/hello.txt', 'Hello, World!');
 *
 * // Retrieve a file
 * const obj = await storage.get('documents/hello.txt');
 * console.log(obj?.text()); // "Hello, World!"
 *
 * // Stream a large file
 * const stream = await storage.getStream('documents/large.bin');
 *
 * // Get a download URL (for S3)
 * const url = await storage.getUrl('documents/hello.txt');
 * ```
 */

// Types - re-export the Storage namespace from core
export type { Storage } from "@ifc-viewer/core";

// Base utilities
export { BaseStorageObject, toBytes, streamToBytes, inferContentType } from "./base";

// Providers
export { LocalStorageProvider, type LocalStorageConfig } from "./providers/local";
export { MemoryStorageProvider } from "./providers/memory";
export { S3StorageProvider, type S3StorageConfig } from "./providers/s3";

// Factory
export {
  createStorageProvider,
  createStorageProviderFromEnv,
  type StorageConfig,
} from "./create";
