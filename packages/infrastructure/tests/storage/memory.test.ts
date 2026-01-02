/**
 * MemoryStorage Tests
 *
 * Tests for the in-memory storage implementation.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { MemoryStorage } from "../../src/storage/memory";

describe("MemoryStorage", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  describe("put and get", () => {
    test("stores and retrieves string data", async () => {
      await storage.put("test.txt", "hello world");

      const result = await storage.get("test.txt");
      expect(result).not.toBeNull();
      expect(result!.text()).toBe("hello world");
    });

    test("stores and retrieves binary data", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      await storage.put("data.bin", data);

      const result = await storage.get("data.bin");
      expect(result).not.toBeNull();
      expect(result!.data).toEqual(data);
    });

    test("stores and retrieves JSON", async () => {
      const jsonData = { name: "test", count: 42 };
      await storage.put("data.json", JSON.stringify(jsonData));

      const result = await storage.get("data.json");
      expect(result!.json<typeof jsonData>()).toEqual(jsonData);
    });

    test("returns null for non-existent key", async () => {
      const result = await storage.get("non-existent.txt");
      expect(result).toBeNull();
    });

    test("overwrites existing data", async () => {
      await storage.put("test.txt", "original");
      await storage.put("test.txt", "updated");

      const result = await storage.get("test.txt");
      expect(result!.text()).toBe("updated");
    });

    test("returns put result with key and size", async () => {
      const result = await storage.put("test.txt", "hello");
      expect(result.key).toBe("test.txt");
      expect(result.size).toBe(5);
    });
  });

  describe("key normalization", () => {
    test("normalizes keys with leading slashes", async () => {
      await storage.put("/test.txt", "content");

      const result = await storage.get("test.txt");
      expect(result).not.toBeNull();
      expect(result!.text()).toBe("content");
    });

    test("normalizes keys with multiple leading slashes", async () => {
      await storage.put("///test.txt", "content");

      const result = await storage.get("test.txt");
      expect(result).not.toBeNull();
    });

    test("access with or without leading slash returns same data", async () => {
      await storage.put("test.txt", "content");

      const result1 = await storage.get("test.txt");
      const result2 = await storage.get("/test.txt");

      expect(result1!.text()).toBe(result2!.text());
    });
  });

  describe("delete", () => {
    test("removes existing key", async () => {
      await storage.put("test.txt", "content");
      expect(await storage.exists("test.txt")).toBe(true);

      await storage.delete("test.txt");
      expect(await storage.exists("test.txt")).toBe(false);
    });

    test("does not throw for non-existent key", async () => {
      await expect(storage.delete("non-existent.txt")).resolves.toBeUndefined();
    });
  });

  describe("exists", () => {
    test("returns true for existing key", async () => {
      await storage.put("test.txt", "content");
      expect(await storage.exists("test.txt")).toBe(true);
    });

    test("returns false for non-existent key", async () => {
      expect(await storage.exists("non-existent.txt")).toBe(false);
    });

    test("normalizes key with leading slash", async () => {
      await storage.put("test.txt", "content");
      expect(await storage.exists("/test.txt")).toBe(true);
    });
  });

  describe("getStream", () => {
    test("returns readable stream for existing key", async () => {
      await storage.put("test.txt", "stream content");

      const stream = await storage.getStream("test.txt");
      expect(stream).not.toBeNull();
      expect(stream).toBeInstanceOf(ReadableStream);

      const reader = stream!.getReader();
      const { value } = await reader.read();
      expect(new TextDecoder().decode(value)).toBe("stream content");
    });

    test("returns null for non-existent key", async () => {
      const stream = await storage.getStream("non-existent.txt");
      expect(stream).toBeNull();
    });
  });

  describe("putStream", () => {
    test("stores data from stream", async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("hello "));
          controller.enqueue(new TextEncoder().encode("world"));
          controller.close();
        },
      });

      await storage.putStream("test.txt", stream);

      const result = await storage.get("test.txt");
      expect(result!.text()).toBe("hello world");
    });
  });

  describe("getUrl", () => {
    test("returns data URL for existing key", async () => {
      await storage.put("test.txt", "hello", { contentType: "text/plain" });

      const url = await storage.getUrl("test.txt");
      expect(url).not.toBeNull();
      expect(url).toMatch(/^data:text\/plain;base64,/);
    });

    test("returns null for non-existent key", async () => {
      const url = await storage.getUrl("non-existent.txt");
      expect(url).toBeNull();
    });

    test("data URL can be decoded", async () => {
      await storage.put("test.txt", "hello world");

      const url = await storage.getUrl("test.txt");
      // Extract base64 part and decode
      const base64 = url!.split(",")[1]!;
      const decoded = Buffer.from(base64, "base64").toString();
      expect(decoded).toBe("hello world");
    });
  });

  describe("getUploadUrl", () => {
    test("returns null (not supported for memory storage)", async () => {
      const result = await storage.getUploadUrl("test.txt");
      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    beforeEach(async () => {
      await storage.put("files/a.txt", "a");
      await storage.put("files/b.txt", "b");
      await storage.put("files/sub/c.txt", "c");
      await storage.put("other/d.txt", "d");
    });

    test("lists all files with prefix", async () => {
      const entries: { key: string }[] = [];
      for await (const entry of storage.list("files/")) {
        entries.push(entry);
      }

      expect(entries.length).toBe(3);
      expect(entries.map((e) => e.key)).toContain("files/a.txt");
      expect(entries.map((e) => e.key)).toContain("files/b.txt");
      expect(entries.map((e) => e.key)).toContain("files/sub/c.txt");
    });

    test("lists all files with empty prefix", async () => {
      const entries: { key: string }[] = [];
      for await (const entry of storage.list("")) {
        entries.push(entry);
      }

      expect(entries.length).toBe(4);
    });

    test("respects maxKeys option", async () => {
      const entries: { key: string }[] = [];
      for await (const entry of storage.list("files/", { maxKeys: 2 })) {
        entries.push(entry);
      }

      expect(entries.length).toBe(2);
    });

    test("respects startAfter option", async () => {
      const entries: { key: string }[] = [];
      for await (const entry of storage.list("files/", {
        startAfter: "files/a.txt",
      })) {
        entries.push(entry);
      }

      expect(entries.map((e) => e.key)).not.toContain("files/a.txt");
      expect(entries.length).toBe(2); // b.txt and sub/c.txt
    });

    test("returns entries in sorted order", async () => {
      const entries: { key: string }[] = [];
      for await (const entry of storage.list("files/")) {
        entries.push(entry);
      }

      const keys = entries.map((e) => e.key);
      expect(keys).toEqual([...keys].sort());
    });

    test("includes size and lastModified in entries", async () => {
      const entries: { key: string; size: number; lastModified?: Date }[] = [];
      for await (const entry of storage.list("files/")) {
        entries.push(entry);
      }

      for (const entry of entries) {
        expect(typeof entry.size).toBe("number");
        expect(entry.lastModified).toBeInstanceOf(Date);
      }
    });

    test("normalizes prefix with leading slash", async () => {
      const entries: { key: string }[] = [];
      for await (const entry of storage.list("/files/")) {
        entries.push(entry);
      }

      expect(entries.length).toBe(3);
    });
  });

  describe("metadata", () => {
    test("infers content type from key", async () => {
      await storage.put("test.json", '{"key": "value"}');

      const result = await storage.get("test.json");
      expect(result!.metadata.contentType).toBe("application/json");
    });

    test("uses provided content type", async () => {
      await storage.put("test.txt", "content", { contentType: "custom/type" });

      const result = await storage.get("test.txt");
      expect(result!.metadata.contentType).toBe("custom/type");
    });

    test("stores custom metadata", async () => {
      await storage.put("test.txt", "content", {
        metadata: { author: "test", version: "1.0" },
      });

      const result = await storage.get("test.txt");
      expect(result!.metadata.customMetadata).toEqual({
        author: "test",
        version: "1.0",
      });
    });

    test("tracks file size", async () => {
      await storage.put("test.txt", "hello");

      const result = await storage.get("test.txt");
      expect(result!.metadata.size).toBe(5);
    });

    test("sets lastModified timestamp", async () => {
      const before = new Date();
      await storage.put("test.txt", "content");
      const after = new Date();

      const result = await storage.get("test.txt");
      expect(result!.metadata.lastModified!.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(result!.metadata.lastModified!.getTime()).toBeLessThanOrEqual(
        after.getTime()
      );
    });
  });

  describe("dispose", () => {
    test("clears all data", async () => {
      await storage.put("a.txt", "a");
      await storage.put("b.txt", "b");
      expect(storage.size).toBe(2);

      await storage.dispose();
      expect(storage.size).toBe(0);
    });
  });

  describe("clear", () => {
    test("removes all stored objects", async () => {
      await storage.put("a.txt", "a");
      await storage.put("b.txt", "b");
      expect(storage.size).toBe(2);

      storage.clear();
      expect(storage.size).toBe(0);
      expect(await storage.get("a.txt")).toBeNull();
    });
  });

  describe("size", () => {
    test("returns number of stored objects", async () => {
      expect(storage.size).toBe(0);

      await storage.put("a.txt", "a");
      expect(storage.size).toBe(1);

      await storage.put("b.txt", "b");
      expect(storage.size).toBe(2);

      await storage.delete("a.txt");
      expect(storage.size).toBe(1);
    });
  });

  describe("type", () => {
    test("returns 'memory'", () => {
      expect(storage.type).toBe("memory");
    });
  });
});
