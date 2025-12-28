/**
 * In-Memory Storage Provider
 *
 * Stores objects in memory. Useful for:
 * - Unit testing
 * - Ephemeral sessions
 * - Development without filesystem
 *
 * Note: Data is lost when the process exits.
 */

import { BaseStorageObject, inferContentType, streamToBytes, toBytes } from "../base";
import type {
  ListOptions,
  PutOptions,
  StorageEntry,
  StorageInput,
  StorageMetadata,
  StorageObject,
  StorageProvider,
  StorageResult,
  UploadCredentials,
  UploadUrlOptions,
  UrlOptions,
} from "../types";

interface StoredObject {
  data: Uint8Array;
  metadata: StorageMetadata;
}

export class MemoryStorageProvider implements StorageProvider {
  readonly type = "memory" as const;

  private store = new Map<string, StoredObject>();

  /**
   * Normalize key by removing leading slashes.
   */
  private normalizeKey(key: string): string {
    return key.replace(/^\/+/, "");
  }

  async get(key: string): Promise<StorageObject | null> {
    const normalizedKey = this.normalizeKey(key);
    const stored = this.store.get(normalizedKey);

    if (!stored) {
      return null;
    }

    return new BaseStorageObject(stored.data, stored.metadata);
  }

  async put(
    key: string,
    data: StorageInput,
    options?: PutOptions
  ): Promise<StorageResult> {
    const normalizedKey = this.normalizeKey(key);
    const bytes = await toBytes(data);

    const metadata: StorageMetadata = {
      key: normalizedKey,
      size: bytes.byteLength,
      contentType: options?.contentType ?? inferContentType(key),
      lastModified: new Date(),
      customMetadata: options?.metadata,
    };

    this.store.set(normalizedKey, { data: bytes, metadata });

    return {
      key: normalizedKey,
      size: bytes.byteLength,
    };
  }

  async delete(key: string): Promise<void> {
    const normalizedKey = this.normalizeKey(key);
    this.store.delete(normalizedKey);
  }

  async exists(key: string): Promise<boolean> {
    const normalizedKey = this.normalizeKey(key);
    return this.store.has(normalizedKey);
  }

  async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const obj = await this.get(key);
    if (!obj) {
      return null;
    }
    return obj.stream();
  }

  async putStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    options?: PutOptions
  ): Promise<StorageResult> {
    const bytes = await streamToBytes(stream);
    return this.put(key, bytes, options);
  }

  async getUrl(key: string, _options?: UrlOptions): Promise<string | null> {
    const normalizedKey = this.normalizeKey(key);
    const stored = this.store.get(normalizedKey);

    if (!stored) {
      return null;
    }

    // Return as data URL
    const base64 = Buffer.from(stored.data).toString("base64");
    const mimeType = stored.metadata.contentType || "application/octet-stream";

    return `data:${mimeType};base64,${base64}`;
  }

  async getUploadUrl(
    _key: string,
    _options?: UploadUrlOptions
  ): Promise<UploadCredentials | null> {
    // Memory storage doesn't support direct upload URLs
    return null;
  }

  async *list(prefix: string, options?: ListOptions): AsyncIterable<StorageEntry> {
    const normalizedPrefix = this.normalizeKey(prefix);
    const maxKeys = options?.maxKeys ?? Infinity;
    let count = 0;
    let shouldStart = !options?.startAfter;

    // Get all keys and sort them
    const keys = Array.from(this.store.keys()).sort();

    for (const key of keys) {
      if (count >= maxKeys) break;

      // Check prefix match
      if (normalizedPrefix && !key.startsWith(normalizedPrefix)) {
        continue;
      }

      // Handle startAfter
      if (!shouldStart) {
        if (key === options?.startAfter) {
          shouldStart = true;
        }
        continue;
      }

      const stored = this.store.get(key)!;
      count++;

      yield {
        key,
        size: stored.metadata.size,
        lastModified: stored.metadata.lastModified,
      };
    }
  }

  async dispose(): Promise<void> {
    this.store.clear();
  }

  /**
   * Get the number of stored objects (useful for testing).
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Clear all stored objects (useful for testing).
   */
  clear(): void {
    this.store.clear();
  }
}
