/**
 * Mock Storage Implementation
 *
 * A simple in-memory mock of the Storage interface for testing.
 */

import type {
  Storage,
  StorageEntry,
  StorageInput,
  StorageListOptions,
  StorageMetadata,
  StorageObject,
  StoragePutOptions,
  StoragePutResult,
  StorageUploadCredentials,
  StorageUploadUrlOptions,
  StorageUrlOptions,
} from "../../src/ports"

/**
 * Create a mock Storage that stores data in memory.
 * Exposes internal _data map for test assertions.
 */
export function createMockStorage(): Storage & {
  _data: Map<string, Uint8Array>
} {
  const data = new Map<string, Uint8Array>()

  const toBytes = (input: StorageInput): Uint8Array => {
    if (typeof input === "string") {
      return new TextEncoder().encode(input)
    }
    if (input instanceof Uint8Array) {
      return input
    }
    if (input instanceof ArrayBuffer) {
      return new Uint8Array(input)
    }
    // Blob and ReadableStream not supported in mock
    throw new Error("Unsupported input type in mock storage")
  }

  return {
    _data: data,
    type: "mock",

    async get(key: string): Promise<StorageObject | null> {
      const content = data.get(key)
      if (!content) return null

      const metadata: StorageMetadata = {
        key,
        size: content.length,
        contentType: "application/octet-stream",
        lastModified: new Date(),
      }

      return {
        data: content,
        metadata,
        text: () => new TextDecoder().decode(content),
        json: <T>() => JSON.parse(new TextDecoder().decode(content)) as T,
        stream: () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(content)
              controller.close()
            },
          }),
      }
    },

    async put(
      key: string,
      input: StorageInput,
      _options?: StoragePutOptions
    ): Promise<StoragePutResult> {
      const bytes = toBytes(input)
      data.set(key, bytes)
      return { key, size: bytes.length }
    },

    async delete(key: string): Promise<void> {
      data.delete(key)
    },

    async exists(key: string): Promise<boolean> {
      return data.has(key)
    },

    async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
      const content = data.get(key)
      if (!content) return null
      return new ReadableStream({
        start(controller) {
          controller.enqueue(content)
          controller.close()
        },
      })
    },

    async putStream(
      key: string,
      stream: ReadableStream<Uint8Array>,
      _options?: StoragePutOptions
    ): Promise<StoragePutResult> {
      const reader = stream.getReader()
      const chunks: Uint8Array[] = []
      let done = false
      while (!done) {
        const result = await reader.read()
        if (result.done) {
          done = true
        } else {
          chunks.push(result.value)
        }
      }
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const bytes = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      data.set(key, bytes)
      return { key, size: bytes.length }
    },

    async getUrl(_key: string, _options?: StorageUrlOptions): Promise<string | null> {
      return null
    },

    async getUploadUrl(
      _key: string,
      _options?: StorageUploadUrlOptions
    ): Promise<StorageUploadCredentials | null> {
      return null
    },

    async *list(prefix: string, options?: StorageListOptions): AsyncIterable<StorageEntry> {
      const keys = [...data.keys()].filter((key) => key.startsWith(prefix)).sort()

      let count = 0
      const maxKeys = options?.maxKeys ?? Infinity
      const startAfter = options?.startAfter

      for (const key of keys) {
        if (startAfter && key <= startAfter) continue
        if (count >= maxKeys) break

        const content = data.get(key)!
        yield {
          key,
          size: content.length,
          lastModified: new Date(),
        }
        count++
      }
    },

    async dispose(): Promise<void> {
      data.clear()
    },
  }
}
