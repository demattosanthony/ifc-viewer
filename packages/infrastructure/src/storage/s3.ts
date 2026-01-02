/**
 * S3-Compatible Storage
 *
 * Stores objects in S3-compatible storage using Bun's native S3 client.
 * Supports:
 * - AWS S3
 * - Cloudflare R2
 * - MinIO
 * - DigitalOcean Spaces
 * - Any S3-compatible storage
 */

import { S3Client } from "bun"
import type {
  Storage,
  StorageInput,
  StorageObject,
  StorageMetadata,
  StoragePutOptions,
  StoragePutResult,
  StorageEntry,
  StorageListOptions,
  StorageUrlOptions,
  StorageUploadUrlOptions,
  StorageUploadCredentials,
} from "@ifc-viewer/core"
import { BaseStorageObject, inferContentType, toBytes } from "./base"

export interface S3StorageConfig {
  /** S3 bucket name */
  bucket: string
  /** AWS access key ID (falls back to S3_ACCESS_KEY_ID env var) */
  accessKeyId?: string
  /** AWS secret access key (falls back to S3_SECRET_ACCESS_KEY env var) */
  secretAccessKey?: string
  /** S3 endpoint URL (for non-AWS S3-compatible services) */
  endpoint?: string
  /** AWS region (falls back to S3_REGION or us-east-1) */
  region?: string
  /** Key prefix for namespacing (e.g., "sessions/abc123/") */
  prefix?: string
}

export class S3Storage implements Storage {
  readonly type = "s3" as const

  private client: S3Client
  private prefix: string

  constructor(private config: S3StorageConfig) {
    this.client = new S3Client({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      bucket: config.bucket,
      endpoint: config.endpoint,
      region: config.region,
    })
    this.prefix = config.prefix?.replace(/\/+$/, "") ?? ""
  }

  /**
   * Build the full S3 key with prefix.
   */
  private buildKey(key: string): string {
    const normalizedKey = key.replace(/^\/+/, "")
    return this.prefix ? `${this.prefix}/${normalizedKey}` : normalizedKey
  }

  /**
   * Strip prefix from a full S3 key.
   */
  private stripPrefix(fullKey: string): string {
    if (this.prefix && fullKey.startsWith(this.prefix + "/")) {
      return fullKey.slice(this.prefix.length + 1)
    }
    return fullKey
  }

  async get(key: string): Promise<StorageObject | null> {
    const s3Key = this.buildKey(key)

    try {
      const file = this.client.file(s3Key)
      const data = await file.bytes()

      const metadata: StorageMetadata = {
        key,
        size: data.byteLength,
        contentType: file.type ?? inferContentType(key),
      }

      return new BaseStorageObject(data, metadata)
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  async put(
    key: string,
    data: StorageInput,
    options?: StoragePutOptions
  ): Promise<StoragePutResult> {
    const s3Key = this.buildKey(key)
    const bytes = await toBytes(data)

    const file = this.client.file(s3Key)
    await file.write(bytes, {
      type: options?.contentType ?? inferContentType(key),
    })

    return {
      key,
      size: bytes.byteLength,
    }
  }

  async delete(key: string): Promise<void> {
    const s3Key = this.buildKey(key)

    try {
      const file = this.client.file(s3Key)
      await file.delete()
    } catch (error) {
      // Ignore if object doesn't exist
      if (!isNotFoundError(error)) {
        throw error
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const s3Key = this.buildKey(key)
    const file = this.client.file(s3Key)
    return file.exists()
  }

  async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const s3Key = this.buildKey(key)

    try {
      const file = this.client.file(s3Key)
      return file.stream()
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  async putStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    options?: StoragePutOptions
  ): Promise<StoragePutResult> {
    // Bun's S3 client can write from Response which wraps a stream
    const s3Key = this.buildKey(key)
    const file = this.client.file(s3Key)

    // Create a Response from the stream to pass to write()
    const response = new Response(stream)
    await file.write(response, {
      type: options?.contentType ?? inferContentType(key),
    })

    // We don't know the exact size without consuming the stream
    // Return 0 and let caller track if needed
    return {
      key,
      size: 0,
    }
  }

  async getUrl(key: string, options?: StorageUrlOptions): Promise<string | null> {
    const s3Key = this.buildKey(key)

    try {
      const file = this.client.file(s3Key)

      // Bun's presign is synchronous
      const url = file.presign({
        expiresIn: options?.expiresIn ?? 3600,
        method: "GET",
      })

      return url
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  async getUploadUrl(
    key: string,
    options?: StorageUploadUrlOptions
  ): Promise<StorageUploadCredentials | null> {
    const s3Key = this.buildKey(key)
    const file = this.client.file(s3Key)

    const url = file.presign({
      expiresIn: options?.expiresIn ?? 300,
      method: "PUT",
    })

    const headers: Record<string, string> = {}
    if (options?.contentType) {
      headers["Content-Type"] = options.contentType
    }

    return {
      url,
      method: "PUT",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    }
  }

  async *list(
    prefix: string,
    options?: StorageListOptions
  ): AsyncIterable<StorageEntry> {
    const s3Prefix = this.buildKey(prefix)
    let startAfter = options?.startAfter
      ? this.buildKey(options.startAfter)
      : undefined

    // Keep fetching pages until we've yielded all results
    while (true) {
      const result = await this.client.list({
        prefix: s3Prefix,
        maxKeys: options?.maxKeys,
        startAfter,
      })

      const contents = result.contents ?? []

      // Yield each object in the current page
      for (const object of contents) {
        if (object.key) {
          yield {
            key: this.stripPrefix(object.key),
            size: object.size ?? 0,
            lastModified: object.lastModified
              ? new Date(object.lastModified)
              : undefined,
          }
        }
      }

      // If there are no more results, stop
      if (!result.isTruncated || contents.length === 0) {
        break
      }

      // Set up for the next page using the last key
      const lastKey = contents[contents.length - 1]?.key
      if (!lastKey) {
        break
      }
      startAfter = lastKey

      // If maxKeys was specified, we only want one page
      if (options?.maxKeys) {
        break
      }
    }
  }

  async dispose(): Promise<void> {
    // No cleanup needed for S3 client
  }

  /**
   * Get the bucket name.
   */
  get bucket(): string {
    return this.config.bucket
  }
}

/**
 * Check if an error is an S3 "not found" error.
 */
function isNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes("not found") ||
      message.includes("nosuchkey") ||
      message.includes("404") ||
      message.includes("does not exist")
    )
  }
  return false
}
