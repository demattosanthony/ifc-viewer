import { describe, test, expect, beforeEach } from "bun:test";
import { MemoryStorageProvider } from "../src/providers/memory";

describe("MemoryStorageProvider", () => {
  let storage: MemoryStorageProvider;

  beforeEach(() => {
    storage = new MemoryStorageProvider();
  });

  describe("type", () => {
    test("returns 'memory'", () => {
      expect(storage.type).toBe("memory");
    });
  });

  describe("put and get", () => {
    test("stores and retrieves a string", async () => {
      await storage.put("hello.txt", "Hello, World!");

      const obj = await storage.get("hello.txt");

      expect(obj).not.toBeNull();
      expect(obj!.text()).toBe("Hello, World!");
    });

    test("stores and retrieves binary data", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      await storage.put("binary.bin", data);

      const obj = await storage.get("binary.bin");

      expect(obj).not.toBeNull();
      expect(obj!.data).toEqual(data);
    });

    test("stores and retrieves an ArrayBuffer", async () => {
      const buffer = new ArrayBuffer(4);
      new Uint8Array(buffer).set([10, 20, 30, 40]);
      await storage.put("buffer.bin", buffer);

      const obj = await storage.get("buffer.bin");

      expect(obj).not.toBeNull();
      expect(Array.from(obj!.data)).toEqual([10, 20, 30, 40]);
    });

    test("stores and retrieves a Blob", async () => {
      const blob = new Blob(["blob content"], { type: "text/plain" });
      await storage.put("blob.txt", blob);

      const obj = await storage.get("blob.txt");

      expect(obj).not.toBeNull();
      expect(obj!.text()).toBe("blob content");
    });

    test("returns null for non-existent key", async () => {
      const obj = await storage.get("non-existent");
      expect(obj).toBeNull();
    });

    test("overwrites existing key", async () => {
      await storage.put("key", "first");
      await storage.put("key", "second");

      const obj = await storage.get("key");
      expect(obj!.text()).toBe("second");
    });

    test("normalizes leading slashes", async () => {
      await storage.put("/leading/slash.txt", "content");

      const obj = await storage.get("leading/slash.txt");
      expect(obj).not.toBeNull();
      expect(obj!.text()).toBe("content");
    });
  });

  describe("StorageObject methods", () => {
    test("text() returns UTF-8 string", async () => {
      await storage.put("unicode.txt", "Hello 世界 🌍");

      const obj = await storage.get("unicode.txt");
      expect(obj!.text()).toBe("Hello 世界 🌍");
    });

    test("json() parses JSON content", async () => {
      await storage.put("data.json", JSON.stringify({ name: "test", value: 42 }));

      const obj = await storage.get("data.json");
      const parsed = obj!.json<{ name: string; value: number }>();

      expect(parsed.name).toBe("test");
      expect(parsed.value).toBe(42);
    });

    test("stream() returns readable stream", async () => {
      await storage.put("stream.txt", "stream content");

      const obj = await storage.get("stream.txt");
      const stream = obj!.stream();

      const reader = stream.getReader();
      const { value } = await reader.read();

      expect(new TextDecoder().decode(value)).toBe("stream content");
    });

    test("metadata contains correct values", async () => {
      await storage.put("meta.txt", "metadata test", {
        contentType: "text/plain",
        metadata: { custom: "value" },
      });

      const obj = await storage.get("meta.txt");

      expect(obj!.metadata.key).toBe("meta.txt");
      expect(obj!.metadata.size).toBe(13);
      expect(obj!.metadata.contentType).toBe("text/plain");
      expect(obj!.metadata.customMetadata).toEqual({ custom: "value" });
      expect(obj!.metadata.lastModified).toBeInstanceOf(Date);
    });
  });

  describe("delete", () => {
    test("removes an object", async () => {
      await storage.put("to-delete.txt", "goodbye");
      await storage.delete("to-delete.txt");

      const obj = await storage.get("to-delete.txt");
      expect(obj).toBeNull();
    });

    test("does not throw for non-existent key", async () => {
      await expect(storage.delete("non-existent")).resolves.toBeUndefined();
    });
  });

  describe("exists", () => {
    test("returns true for existing key", async () => {
      await storage.put("exists.txt", "yes");
      expect(await storage.exists("exists.txt")).toBe(true);
    });

    test("returns false for non-existent key", async () => {
      expect(await storage.exists("not-there")).toBe(false);
    });
  });

  describe("getStream", () => {
    test("returns stream for existing key", async () => {
      await storage.put("streamed.txt", "streamed data");

      const stream = await storage.getStream("streamed.txt");
      expect(stream).not.toBeNull();

      const reader = stream!.getReader();
      const { value } = await reader.read();
      expect(new TextDecoder().decode(value)).toBe("streamed data");
    });

    test("returns null for non-existent key", async () => {
      const stream = await storage.getStream("non-existent");
      expect(stream).toBeNull();
    });
  });

  describe("putStream", () => {
    test("stores data from stream", async () => {
      const data = new TextEncoder().encode("stream input");
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

      await storage.putStream("from-stream.txt", stream);

      const obj = await storage.get("from-stream.txt");
      expect(obj!.text()).toBe("stream input");
    });

    test("handles multi-chunk stream", async () => {
      const chunks = ["chunk1", "chunk2", "chunk3"];
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        },
      });

      await storage.putStream("multi-chunk.txt", stream);

      const obj = await storage.get("multi-chunk.txt");
      expect(obj!.text()).toBe("chunk1chunk2chunk3");
    });
  });

  describe("getUrl", () => {
    test("returns data URL for existing key", async () => {
      await storage.put("url.txt", "url content");

      const url = await storage.getUrl("url.txt");

      expect(url).not.toBeNull();
      expect(url).toMatch(/^data:/);
      expect(url).toContain("base64");
    });

    test("returns null for non-existent key", async () => {
      const url = await storage.getUrl("non-existent");
      expect(url).toBeNull();
    });

    test("data URL decodes to original content", async () => {
      const content = "Hello, World!";
      await storage.put("decode.txt", content);

      const url = await storage.getUrl("decode.txt");
      const base64 = url!.split(",")[1]!;
      const decoded = Buffer.from(base64, "base64").toString();

      expect(decoded).toBe(content);
    });
  });

  describe("getUploadUrl", () => {
    test("returns null (not supported)", async () => {
      const creds = await storage.getUploadUrl("any-key");
      expect(creds).toBeNull();
    });
  });

  describe("list", () => {
    beforeEach(async () => {
      await storage.put("docs/readme.md", "readme");
      await storage.put("docs/guide.md", "guide");
      await storage.put("src/index.ts", "index");
      await storage.put("src/utils.ts", "utils");
      await storage.put("package.json", "package");
    });

    test("lists all objects with empty prefix", async () => {
      const entries = [];
      for await (const entry of storage.list("")) {
        entries.push(entry);
      }

      expect(entries).toHaveLength(5);
      const keys = entries.map((e) => e.key);
      expect(keys).toContain("docs/readme.md");
      expect(keys).toContain("src/index.ts");
      expect(keys).toContain("package.json");
    });

    test("filters by prefix", async () => {
      const entries = [];
      for await (const entry of storage.list("docs/")) {
        entries.push(entry);
      }

      expect(entries).toHaveLength(2);
      const keys = entries.map((e) => e.key);
      expect(keys).toContain("docs/readme.md");
      expect(keys).toContain("docs/guide.md");
    });

    test("respects maxKeys option", async () => {
      const entries = [];
      for await (const entry of storage.list("", { maxKeys: 2 })) {
        entries.push(entry);
      }

      expect(entries).toHaveLength(2);
    });

    test("respects startAfter option", async () => {
      const entries = [];
      for await (const entry of storage.list("", { startAfter: "docs/readme.md" })) {
        entries.push(entry);
      }

      // Should skip docs/guide.md, docs/readme.md and start after docs/readme.md
      const keys = entries.map((e) => e.key);
      expect(keys).not.toContain("docs/guide.md");
      expect(keys).not.toContain("docs/readme.md");
    });

    test("entries have correct metadata", async () => {
      const entries = [];
      for await (const entry of storage.list("package")) {
        entries.push(entry);
      }

      expect(entries).toHaveLength(1);
      expect(entries[0]!.key).toBe("package.json");
      expect(entries[0]!.size).toBe(7); // "package"
      expect(entries[0]!.lastModified).toBeInstanceOf(Date);
    });
  });

  describe("dispose", () => {
    test("clears all stored objects", async () => {
      await storage.put("a", "a");
      await storage.put("b", "b");

      expect(storage.size).toBe(2);

      await storage.dispose();

      expect(storage.size).toBe(0);
    });
  });

  describe("size and clear", () => {
    test("size returns count of stored objects", async () => {
      expect(storage.size).toBe(0);

      await storage.put("one", "1");
      expect(storage.size).toBe(1);

      await storage.put("two", "2");
      expect(storage.size).toBe(2);

      await storage.delete("one");
      expect(storage.size).toBe(1);
    });

    test("clear removes all objects", async () => {
      await storage.put("a", "a");
      await storage.put("b", "b");

      storage.clear();

      expect(storage.size).toBe(0);
      expect(await storage.get("a")).toBeNull();
    });
  });

  describe("content type inference", () => {
    test("infers content type from extension", async () => {
      await storage.put("image.png", new Uint8Array([1, 2, 3]));
      await storage.put("script.js", "console.log()");
      await storage.put("styles.css", "body {}");
      await storage.put("model.ifc", "IFC content");

      const png = await storage.get("image.png");
      const js = await storage.get("script.js");
      const css = await storage.get("styles.css");
      const ifc = await storage.get("model.ifc");

      expect(png!.metadata.contentType).toBe("image/png");
      expect(js!.metadata.contentType).toBe("text/javascript");
      expect(css!.metadata.contentType).toBe("text/css");
      expect(ifc!.metadata.contentType).toBe("application/x-step");
    });

    test("uses provided content type over inference", async () => {
      await storage.put("data.txt", "binary", { contentType: "application/octet-stream" });

      const obj = await storage.get("data.txt");
      expect(obj!.metadata.contentType).toBe("application/octet-stream");
    });
  });
});
