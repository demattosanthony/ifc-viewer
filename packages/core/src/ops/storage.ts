/**
 * Storage Operations Contract
 *
 * Defines the interface for blob/object storage operations.
 * Implementations: local filesystem, S3, memory
 */

/** Flexible input types for storage operations */
export type StorageInput =
  | string
  | Uint8Array
  | ArrayBuffer
  | Blob
  | ReadableStream<Uint8Array>

/** Metadata associated with a stored object */
export type StorageMetadata = {
  key: string
  size: number
  contentType?: string
  etag?: string
  lastModified?: Date
  customMetadata?: Record<string, string>
}

/** A stored object with its data and metadata */
export type StorageObject = {
  readonly data: Uint8Array
  readonly metadata: StorageMetadata
  text(): string
  json<T = unknown>(): T
  stream(): ReadableStream<Uint8Array>
}

/** Entry returned when listing objects */
export type StorageEntry = {
  key: string
  size: number
  lastModified?: Date
}

/** Options for put operations */
export type PutOptions = {
  contentType?: string
  metadata?: Record<string, string>
}

/** Options for listing objects */
export type ListOptions = {
  maxKeys?: number
  startAfter?: string
}

/** Options for generating download URLs */
export type UrlOptions = {
  expiresIn?: number
  download?: boolean
  filename?: string
}

/** Options for generating upload URLs */
export type UploadUrlOptions = {
  expiresIn?: number
  contentType?: string
  maxSize?: number
}

/** Credentials for direct upload */
export type UploadCredentials = {
  url: string
  method: "PUT" | "POST"
  headers?: Record<string, string>
  fields?: Record<string, string>
}

/** Result of a put operation */
export type StorageResult = {
  key: string
  size: number
  etag?: string
}

/** Storage operations contract */
export type StorageOps = {
  readonly type: string
  get(key: string): Promise<StorageObject | null>
  put(key: string, data: StorageInput, options?: PutOptions): Promise<StorageResult>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  getStream(key: string): Promise<ReadableStream<Uint8Array> | null>
  putStream(key: string, stream: ReadableStream<Uint8Array>, options?: PutOptions): Promise<StorageResult>
  getUrl(key: string, options?: UrlOptions): Promise<string | null>
  getUploadUrl(key: string, options?: UploadUrlOptions): Promise<UploadCredentials | null>
  list(prefix: string, options?: ListOptions): AsyncIterable<StorageEntry>
  dispose?(): Promise<void>
}
