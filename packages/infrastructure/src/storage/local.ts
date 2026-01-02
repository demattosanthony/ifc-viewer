/**
 * Local Filesystem Storage
 *
 * Stores objects on the local filesystem using Bun's native file APIs.
 * Ideal for local development and single-server deployments.
 */

import { lstat, mkdir, readdir, rm, stat } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
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
import {
  BaseStorageObject,
  inferContentType,
  streamToBytes,
  toBytes,
} from "./base"

export interface LocalStorageConfig {
  /** Base directory for storage */
  baseDir: string
  /**
   * URL mode for getUrl():
   * - 'none': Return null (default)
   * - 'data': Return data: URLs (works everywhere, but loads into memory)
   */
  urlMode?: "none" | "data"
}

export class LocalStorage implements Storage {
  readonly type = "local" as const

  private readonly baseDir: string
  private readonly urlMode: "none" | "data"

  constructor(config: LocalStorageConfig) {
    this.baseDir = resolve(config.baseDir)
    this.urlMode = config.urlMode ?? "none"
  }

  /**
   * Resolve a key to an absolute filesystem path.
   * Prevents path traversal attacks.
   */
  private resolvePath(key: string): string {
    // Normalize the key - remove leading slashes
    const normalizedKey = key.replace(/^\/+/, "")
    const resolved = resolve(this.baseDir, normalizedKey)

    // Security: prevent escaping base directory
    if (!resolved.startsWith(this.baseDir)) {
      throw new Error(`Invalid key: path escapes storage directory`)
    }

    return resolved
  }

  /**
   * Ensure parent directory exists for a given path.
   */
  private async ensureDir(filePath: string): Promise<void> {
    const dir = dirname(filePath)
    await mkdir(dir, { recursive: true })
  }

  async get(key: string): Promise<StorageObject | null> {
    const path = this.resolvePath(key)
    const file = Bun.file(path)

    const exists = await file.exists()
    if (!exists) {
      return null
    }

    const data = new Uint8Array(await file.arrayBuffer())
    const fileStat = await stat(path)

    // Use our own inference to get consistent content types without charset
    const metadata: StorageMetadata = {
      key,
      size: data.byteLength,
      contentType: inferContentType(key),
      lastModified: new Date(fileStat.mtimeMs),
    }

    return new BaseStorageObject(data, metadata)
  }

  async put(
    key: string,
    data: StorageInput,
    options?: StoragePutOptions
  ): Promise<StoragePutResult> {
    const path = this.resolvePath(key)
    await this.ensureDir(path)

    const bytes = await toBytes(data)
    await Bun.write(path, bytes)

    return {
      key,
      size: bytes.byteLength,
    }
  }

  async delete(key: string): Promise<void> {
    const path = this.resolvePath(key)

    try {
      await rm(path)
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const path = this.resolvePath(key)
    const file = Bun.file(path)
    return file.exists()
  }

  async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const path = this.resolvePath(key)
    const file = Bun.file(path)

    const exists = await file.exists()
    if (!exists) {
      return null
    }

    return file.stream()
  }

  async putStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    options?: StoragePutOptions
  ): Promise<StoragePutResult> {
    // For local filesystem, we collect the stream and write it
    // Bun.write can handle streams directly, but we need the size
    const bytes = await streamToBytes(stream)
    return this.put(key, bytes, options)
  }

  async getUrl(key: string, options?: StorageUrlOptions): Promise<string | null> {
    if (this.urlMode === "none") {
      return null
    }

    const path = this.resolvePath(key)
    const file = Bun.file(path)

    const exists = await file.exists()
    if (!exists) {
      return null
    }

    // Data URL mode - load file and encode as base64
    const data = await file.arrayBuffer()
    const base64 = Buffer.from(data).toString("base64")
    const mimeType = inferContentType(key)

    return `data:${mimeType};base64,${base64}`
  }

  async getUploadUrl(
    _key: string,
    _options?: StorageUploadUrlOptions
  ): Promise<StorageUploadCredentials | null> {
    // Local storage doesn't support direct upload URLs
    // Clients must upload through the API
    return null
  }

  async *list(prefix: string, options?: StorageListOptions): AsyncIterable<StorageEntry> {
    const basePath = this.resolvePath(prefix || "")
    let count = 0
    const maxKeys = options?.maxKeys ?? Infinity
    const shouldStart = !options?.startAfter
    const startAfterKey = options?.startAfter
    let started = shouldStart

    // Check if the prefix is a file (not a directory)
    try {
      const pathStat = await lstat(basePath)
      if (pathStat.isFile()) {
        // If prefix points to a file, yield just that file
        const key = basePath.slice(this.baseDir.length).replace(/^\/+/, "")
        if (started || key === startAfterKey) {
          yield {
            key,
            size: pathStat.size,
            lastModified: new Date(pathStat.mtimeMs),
          }
        }
        return
      }
    } catch {
      // Path doesn't exist, nothing to list
      return
    }

    const provider = this

    async function* walkDir(dir: string): AsyncIterable<StorageEntry> {
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }

      // Sort for consistent ordering
      entries.sort((a, b) => a.name.localeCompare(b.name))

      for (const entry of entries) {
        if (count >= maxKeys) return

        const fullPath = join(dir, entry.name)
        const key = fullPath.slice(provider.baseDir.length).replace(/^\/+/, "")

        if (entry.isDirectory()) {
          yield* walkDir(fullPath)
        } else {
          // Handle startAfter
          if (!started) {
            if (key === startAfterKey) {
              started = true
            }
            continue
          }

          try {
            const fileStat = await stat(fullPath)
            count++
            yield {
              key,
              size: fileStat.size,
              lastModified: new Date(fileStat.mtimeMs),
            }
          } catch {
            // Skip files we can't stat
          }
        }
      }
    }

    yield* walkDir(basePath)
  }

  async dispose(): Promise<void> {
    // No cleanup needed for local storage
  }
}
