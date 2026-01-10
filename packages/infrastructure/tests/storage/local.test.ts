/**
 * LocalStorage Tests
 *
 * Tests for the local filesystem storage implementation including
 * security tests for path traversal prevention.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { LocalStorage } from "../../src/storage/local"

describe("LocalStorage", () => {
  let baseDir: string
  let storage: LocalStorage

  beforeEach(async () => {
    // Create a unique temp directory for each test
    baseDir = join(tmpdir(), `storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(baseDir, { recursive: true })
    storage = new LocalStorage({ baseDir })
  })

  afterEach(async () => {
    // Clean up temp directory
    await rm(baseDir, { recursive: true, force: true })
  })

  // ============================================================================
  // SECURITY TESTS - Path Traversal Prevention (CRITICAL)
  // ============================================================================

  describe("security - path traversal prevention", () => {
    test("rejects key with .. escaping storage directory", () => {
      expect(() => storage["resolvePath"]("../outside")).toThrow("escapes storage")
    })

    test("rejects key with multiple .. sequences", () => {
      expect(() => storage["resolvePath"]("foo/../../outside")).toThrow("escapes storage")
    })

    test("allows keys within storage directory", () => {
      expect(() => storage["resolvePath"]("subdir/file.txt")).not.toThrow()
      expect(() => storage["resolvePath"]("deeply/nested/path/file.txt")).not.toThrow()
    })

    test("allows .. that stays within storage directory", () => {
      expect(() => storage["resolvePath"]("subdir/../file.txt")).not.toThrow()
    })

    test("get rejects path traversal", async () => {
      await expect(storage.get("../outside.txt")).rejects.toThrow("escapes storage")
    })

    test("put rejects path traversal", async () => {
      await expect(storage.put("../outside.txt", "malicious")).rejects.toThrow("escapes storage")
    })

    test("delete rejects path traversal", async () => {
      await expect(storage.delete("../outside.txt")).rejects.toThrow("escapes storage")
    })

    test("exists rejects path traversal", async () => {
      await expect(storage.exists("../outside.txt")).rejects.toThrow("escapes storage")
    })

    test("getStream rejects path traversal", async () => {
      await expect(storage.getStream("../outside.txt")).rejects.toThrow("escapes storage")
    })

    test("list rejects path traversal", async () => {
      const generator = storage.list("../")
      const iterator = generator[Symbol.asyncIterator]()
      await expect(iterator.next()).rejects.toThrow("escapes storage")
    })
  })

  // ============================================================================
  // Basic Operations
  // ============================================================================

  describe("put and get", () => {
    test("stores and retrieves string data", async () => {
      await storage.put("test.txt", "hello world")

      const result = await storage.get("test.txt")
      expect(result).not.toBeNull()
      expect(result!.text()).toBe("hello world")
    })

    test("stores and retrieves binary data", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5])
      await storage.put("data.bin", data)

      const result = await storage.get("data.bin")
      expect(result).not.toBeNull()
      expect(result!.data).toEqual(data)
    })

    test("stores and retrieves JSON", async () => {
      const jsonData = { name: "test", count: 42 }
      await storage.put("data.json", JSON.stringify(jsonData))

      const result = await storage.get("data.json")
      expect(result!.json<typeof jsonData>()).toEqual(jsonData)
    })

    test("returns null for non-existent key", async () => {
      const result = await storage.get("non-existent.txt")
      expect(result).toBeNull()
    })

    test("overwrites existing file", async () => {
      await storage.put("test.txt", "original")
      await storage.put("test.txt", "updated")

      const result = await storage.get("test.txt")
      expect(result!.text()).toBe("updated")
    })

    test("returns put result with key and size", async () => {
      const result = await storage.put("test.txt", "hello")
      expect(result.key).toBe("test.txt")
      expect(result.size).toBe(5)
    })

    test("creates parent directories automatically", async () => {
      await storage.put("a/b/c/file.txt", "nested content")

      const result = await storage.get("a/b/c/file.txt")
      expect(result!.text()).toBe("nested content")
    })
  })

  describe("key normalization", () => {
    test("normalizes keys with leading slashes", async () => {
      await storage.put("/test.txt", "content")

      const result = await storage.get("test.txt")
      expect(result).not.toBeNull()
      expect(result!.text()).toBe("content")
    })

    test("normalizes keys with multiple leading slashes", async () => {
      await storage.put("///test.txt", "content")

      const result = await storage.get("test.txt")
      expect(result).not.toBeNull()
    })
  })

  describe("delete", () => {
    test("removes existing file", async () => {
      await storage.put("test.txt", "content")
      expect(await storage.exists("test.txt")).toBe(true)

      await storage.delete("test.txt")
      expect(await storage.exists("test.txt")).toBe(false)
    })

    test("does not throw for non-existent file", async () => {
      await expect(storage.delete("non-existent.txt")).resolves.toBeUndefined()
    })
  })

  describe("exists", () => {
    test("returns true for existing file", async () => {
      await storage.put("test.txt", "content")
      expect(await storage.exists("test.txt")).toBe(true)
    })

    test("returns false for non-existent file", async () => {
      expect(await storage.exists("non-existent.txt")).toBe(false)
    })

    test("normalizes key with leading slash", async () => {
      await storage.put("test.txt", "content")
      expect(await storage.exists("/test.txt")).toBe(true)
    })
  })

  describe("getStream", () => {
    test("returns readable stream for existing file", async () => {
      await storage.put("test.txt", "stream content")

      const stream = await storage.getStream("test.txt")
      expect(stream).not.toBeNull()
      expect(stream).toBeInstanceOf(ReadableStream)

      // Read the stream
      const reader = stream!.getReader()
      const chunks: Uint8Array[] = []
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0))
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      const content = new TextDecoder().decode(combined)
      expect(content).toBe("stream content")
    })

    test("returns null for non-existent file", async () => {
      const stream = await storage.getStream("non-existent.txt")
      expect(stream).toBeNull()
    })
  })

  describe("putStream", () => {
    test("stores data from stream", async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("hello "))
          controller.enqueue(new TextEncoder().encode("world"))
          controller.close()
        },
      })

      await storage.putStream("test.txt", stream)

      const result = await storage.get("test.txt")
      expect(result!.text()).toBe("hello world")
    })
  })

  describe("getUrl", () => {
    test("returns null when urlMode is 'none' (default)", async () => {
      await storage.put("test.txt", "content")

      const url = await storage.getUrl("test.txt")
      expect(url).toBeNull()
    })

    test("returns data URL when urlMode is 'data'", async () => {
      const dataStorage = new LocalStorage({ baseDir, urlMode: "data" })
      await dataStorage.put("test.txt", "hello")

      const url = await dataStorage.getUrl("test.txt")
      expect(url).not.toBeNull()
      expect(url).toMatch(/^data:text\/plain;base64,/)
    })

    test("returns null for non-existent file with data mode", async () => {
      const dataStorage = new LocalStorage({ baseDir, urlMode: "data" })

      const url = await dataStorage.getUrl("non-existent.txt")
      expect(url).toBeNull()
    })

    test("data URL can be decoded", async () => {
      const dataStorage = new LocalStorage({ baseDir, urlMode: "data" })
      await dataStorage.put("test.txt", "hello world")

      const url = await dataStorage.getUrl("test.txt")
      // Extract base64 part and decode
      const base64 = url!.split(",")[1]!
      const decoded = Buffer.from(base64, "base64").toString()
      expect(decoded).toBe("hello world")
    })
  })

  describe("getUploadUrl", () => {
    test("returns null (not supported for local storage)", async () => {
      const result = await storage.getUploadUrl("test.txt")
      expect(result).toBeNull()
    })
  })

  describe("list", () => {
    beforeEach(async () => {
      await storage.put("files/a.txt", "a")
      await storage.put("files/b.txt", "b")
      await storage.put("files/sub/c.txt", "c")
      await storage.put("other/d.txt", "d")
    })

    test("lists all files with prefix", async () => {
      const entries: { key: string }[] = []
      for await (const entry of storage.list("files/")) {
        entries.push(entry)
      }

      expect(entries.length).toBe(3)
      expect(entries.map((e) => e.key)).toContain("files/a.txt")
      expect(entries.map((e) => e.key)).toContain("files/b.txt")
      expect(entries.map((e) => e.key)).toContain("files/sub/c.txt")
    })

    test("lists all files with empty prefix", async () => {
      const entries: { key: string }[] = []
      for await (const entry of storage.list("")) {
        entries.push(entry)
      }

      expect(entries.length).toBe(4)
    })

    test("respects maxKeys option", async () => {
      const entries: { key: string }[] = []
      for await (const entry of storage.list("files/", { maxKeys: 2 })) {
        entries.push(entry)
      }

      expect(entries.length).toBe(2)
    })

    test("includes size and lastModified in entries", async () => {
      const entries: { key: string; size: number; lastModified?: Date }[] = []
      for await (const entry of storage.list("files/")) {
        entries.push(entry)
      }

      for (const entry of entries) {
        expect(typeof entry.size).toBe("number")
        expect(entry.lastModified).toBeInstanceOf(Date)
      }
    })
  })

  describe("metadata", () => {
    test("infers content type from key", async () => {
      await storage.put("test.json", '{"key": "value"}')

      const result = await storage.get("test.json")
      expect(result!.metadata.contentType).toBe("application/json")
    })

    test("tracks file size", async () => {
      await storage.put("test.txt", "hello")

      const result = await storage.get("test.txt")
      expect(result!.metadata.size).toBe(5)
    })

    test("sets lastModified timestamp", async () => {
      const before = new Date()
      await storage.put("test.txt", "content")
      const after = new Date()

      const result = await storage.get("test.txt")
      expect(result!.metadata.lastModified!.getTime()).toBeGreaterThanOrEqual(
        before.getTime() - 1000
      ) // Allow 1s tolerance
      expect(result!.metadata.lastModified!.getTime()).toBeLessThanOrEqual(after.getTime() + 1000)
    })
  })

  describe("type", () => {
    test("returns 'local'", () => {
      expect(storage.type).toBe("local")
    })
  })

  describe("dispose", () => {
    test("completes without error", async () => {
      await expect(storage.dispose()).resolves.toBeUndefined()
    })
  })
})
