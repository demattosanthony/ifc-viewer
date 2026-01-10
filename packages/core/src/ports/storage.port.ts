/**
 * Storage Port
 *
 * Defines the interface for blob/object storage operations.
 * Implementations: local filesystem, S3, memory
 */

// ============================================================================
// Storage Types
// ============================================================================

/** Flexible input types for storage operations */
export type StorageInput = string | Uint8Array | ArrayBuffer | Blob | ReadableStream<Uint8Array>

/** Metadata associated with a stored object */
export interface StorageMetadata {
  key: string
  size: number
  contentType?: string
  etag?: string
  lastModified?: Date
  customMetadata?: Record<string, string>
}

/** A stored object with its data and metadata */
export interface StorageObject {
  readonly data: Uint8Array
  readonly metadata: StorageMetadata
  text(): string
  json<T = unknown>(): T
  stream(): ReadableStream<Uint8Array>
}

/** Entry returned when listing objects */
export interface StorageEntry {
  key: string
  size: number
  lastModified?: Date
}

/** Options for put operations */
export interface StoragePutOptions {
  contentType?: string
  metadata?: Record<string, string>
}

/** Options for listing objects */
export interface StorageListOptions {
  maxKeys?: number
  startAfter?: string
}

/** Options for generating download URLs */
export interface StorageUrlOptions {
  expiresIn?: number
  download?: boolean
  filename?: string
}

/** Options for generating upload URLs */
export interface StorageUploadUrlOptions {
  expiresIn?: number
  contentType?: string
  maxSize?: number
}

/** Credentials for direct upload */
export interface StorageUploadCredentials {
  url: string
  method: "PUT" | "POST"
  headers?: Record<string, string>
  fields?: Record<string, string>
}

/** Result of a put operation */
export interface StoragePutResult {
  key: string
  size: number
  etag?: string
}

// ============================================================================
// Storage Provider
// ============================================================================

/** Storage provider interface */
export interface Storage {
  readonly type: string
  get(key: string): Promise<StorageObject | null>
  put(key: string, data: StorageInput, options?: StoragePutOptions): Promise<StoragePutResult>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  getStream(key: string): Promise<ReadableStream<Uint8Array> | null>
  putStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    options?: StoragePutOptions
  ): Promise<StoragePutResult>
  getUrl(key: string, options?: StorageUrlOptions): Promise<string | null>
  getUploadUrl(
    key: string,
    options?: StorageUploadUrlOptions
  ): Promise<StorageUploadCredentials | null>
  list(prefix: string, options?: StorageListOptions): AsyncIterable<StorageEntry>
  dispose?(): Promise<void>
}
