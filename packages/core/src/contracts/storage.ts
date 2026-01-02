/**
 * Storage Contract
 *
 * Defines the interface for blob/object storage operations.
 * Implementations: local filesystem, S3, memory
 */

export namespace Storage {
  /** Flexible input types for storage operations */
  export type Input =
    | string
    | Uint8Array
    | ArrayBuffer
    | Blob
    | ReadableStream<Uint8Array>

  /** Metadata associated with a stored object */
  export type Metadata = {
    key: string
    size: number
    contentType?: string
    etag?: string
    lastModified?: Date
    customMetadata?: Record<string, string>
  }

  /** A stored object with its data and metadata */
  export type Object = {
    readonly data: Uint8Array
    readonly metadata: Metadata
    text(): string
    json<T = unknown>(): T
    stream(): ReadableStream<Uint8Array>
  }

  /** Entry returned when listing objects */
  export type Entry = {
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
  export type Result = {
    key: string
    size: number
    etag?: string
  }

  /** Storage provider interface */
  export type Provider = {
    readonly type: string
    get(key: string): Promise<Object | null>
    put(key: string, data: Input, options?: PutOptions): Promise<Result>
    delete(key: string): Promise<void>
    exists(key: string): Promise<boolean>
    getStream(key: string): Promise<ReadableStream<Uint8Array> | null>
    putStream(
      key: string,
      stream: ReadableStream<Uint8Array>,
      options?: PutOptions
    ): Promise<Result>
    getUrl(key: string, options?: UrlOptions): Promise<string | null>
    getUploadUrl(key: string, options?: UploadUrlOptions): Promise<UploadCredentials | null>
    list(prefix: string, options?: ListOptions): AsyncIterable<Entry>
    dispose?(): Promise<void>
  }
}
