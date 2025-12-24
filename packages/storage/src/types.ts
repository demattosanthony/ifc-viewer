/**
 * Storage Provider Types
 *
 * A clean abstraction for blob/object storage that supports multiple backends:
 * - Local filesystem
 * - S3-compatible storage (AWS S3, Cloudflare R2, MinIO, etc.)
 * - In-memory (for testing)
 */

/**
 * Flexible input types for storage operations.
 * Accepts common data formats that can be written to storage.
 */
export type StorageInput =
  | string
  | Uint8Array
  | ArrayBuffer
  | Blob
  | ReadableStream<Uint8Array>;

/**
 * Metadata associated with a stored object.
 */
export interface StorageMetadata {
  /** The object's key/path in storage */
  key: string;
  /** Size in bytes */
  size: number;
  /** MIME type of the content */
  contentType?: string;
  /** Entity tag for cache validation */
  etag?: string;
  /** Last modification timestamp */
  lastModified?: Date;
  /** User-defined metadata */
  customMetadata?: Record<string, string>;
}

/**
 * A stored object with its data and metadata.
 * Provides convenience methods for common data access patterns.
 */
export interface StorageObject {
  /** Raw binary data */
  readonly data: Uint8Array;
  /** Object metadata */
  readonly metadata: StorageMetadata;

  /** Read data as UTF-8 text */
  text(): string;
  /** Parse data as JSON */
  json<T = unknown>(): T;
  /** Get a readable stream of the data */
  stream(): ReadableStream<Uint8Array>;
}

/**
 * Entry returned when listing objects in storage.
 */
export interface StorageEntry {
  /** The object's key/path */
  key: string;
  /** Size in bytes */
  size: number;
  /** Last modification timestamp */
  lastModified?: Date;
}

/**
 * Options for put operations.
 */
export interface PutOptions {
  /** MIME type of the content */
  contentType?: string;
  /** User-defined metadata */
  metadata?: Record<string, string>;
}

/**
 * Options for listing objects.
 */
export interface ListOptions {
  /** Maximum number of keys to return */
  maxKeys?: number;
  /** Start listing after this key */
  startAfter?: string;
}

/**
 * Options for generating download URLs.
 */
export interface UrlOptions {
  /** URL expiration time in seconds (default: 3600) */
  expiresIn?: number;
  /** Force download with Content-Disposition: attachment */
  download?: boolean;
  /** Custom filename for downloads */
  filename?: string;
}

/**
 * Options for generating upload URLs.
 */
export interface UploadUrlOptions {
  /** URL expiration time in seconds (default: 300) */
  expiresIn?: number;
  /** Expected content type */
  contentType?: string;
  /** Maximum upload size in bytes */
  maxSize?: number;
}

/**
 * Credentials for direct upload to storage.
 */
export interface UploadCredentials {
  /** The URL to upload to */
  url: string;
  /** HTTP method to use */
  method: "PUT" | "POST";
  /** Headers to include in the upload request */
  headers?: Record<string, string>;
  /** Form fields for multipart POST uploads */
  fields?: Record<string, string>;
}

/**
 * Result of a successful put operation.
 */
export interface StorageResult {
  /** The object's key/path */
  key: string;
  /** Size in bytes */
  size: number;
  /** Entity tag (if available) */
  etag?: string;
}

/**
 * Core storage provider interface.
 *
 * Implementations handle the actual storage backend (filesystem, S3, etc.)
 * while presenting a unified API to consumers.
 */
export interface StorageProvider {
  /** Provider type identifier */
  readonly type: string;

  /**
   * Retrieve an object from storage.
   * @param key - The object's key/path
   * @returns The object with data and metadata, or null if not found
   */
  get(key: string): Promise<StorageObject | null>;

  /**
   * Store an object.
   * @param key - The object's key/path
   * @param data - The data to store
   * @param options - Optional put options
   * @returns Result with key, size, and optional etag
   */
  put(
    key: string,
    data: StorageInput,
    options?: PutOptions
  ): Promise<StorageResult>;

  /**
   * Delete an object from storage.
   * @param key - The object's key/path
   */
  delete(key: string): Promise<void>;

  /**
   * Check if an object exists.
   * @param key - The object's key/path
   * @returns True if the object exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get a readable stream for an object.
   * Preferred for large files to avoid loading into memory.
   * @param key - The object's key/path
   * @returns A readable stream, or null if not found
   */
  getStream(key: string): Promise<ReadableStream<Uint8Array> | null>;

  /**
   * Store data from a stream.
   * Preferred for large files to avoid loading into memory.
   * @param key - The object's key/path
   * @param stream - The data stream
   * @param options - Optional put options
   * @returns Result with key, size, and optional etag
   */
  putStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    options?: PutOptions
  ): Promise<StorageResult>;

  /**
   * Generate a URL for downloading an object.
   * For S3, returns a presigned URL. For local, may return a data: URL.
   * @param key - The object's key/path
   * @param options - URL generation options
   * @returns A download URL, or null if not supported/not found
   */
  getUrl(key: string, options?: UrlOptions): Promise<string | null>;

  /**
   * Generate credentials for direct upload.
   * Allows clients to upload directly to storage, bypassing the API.
   * @param key - The object's key/path
   * @param options - Upload URL options
   * @returns Upload credentials, or null if not supported
   */
  getUploadUrl(
    key: string,
    options?: UploadUrlOptions
  ): Promise<UploadCredentials | null>;

  /**
   * List objects with a given prefix.
   * @param prefix - Key prefix to filter by
   * @param options - Listing options
   * @returns Async iterable of storage entries
   */
  list(prefix: string, options?: ListOptions): AsyncIterable<StorageEntry>;

  /**
   * Clean up resources.
   */
  dispose?(): Promise<void>;
}
