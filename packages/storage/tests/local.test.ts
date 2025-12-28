import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { LocalStorageProvider } from "../src/providers/local";
import { rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

describe("LocalStorageProvider", () => {
  const testDir = "/tmp/storage-test-" + Date.now();
  let storage: LocalStorageProvider;

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    storage = new LocalStorageProvider({ baseDir: testDir });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("type", () => {
    test("returns 'local'", () => {
      expect(storage.type).toBe("local");
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

    test("creates parent directories automatically", async () => {
      await storage.put("nested/deep/path/file.txt", "nested content");

      const obj = await storage.get("nested/deep/path/file.txt");
      expect(obj!.text()).toBe("nested content");
    });

    test("returns null for non-existent key", async () => {
      const obj = await storage.get("non-existent");
      expect(obj).toBeNull();
    });

    test("overwrites existing key", async () => {
      await storage.put("key.txt", "first");
      await storage.put("key.txt", "second");

      const obj = await storage.get("key.txt");
      expect(obj!.text()).toBe("second");
    });

    test("normalizes leading slashes", async () => {
      await storage.put("/leading/slash.txt", "content");

      const obj = await storage.get("leading/slash.txt");
      expect(obj).not.toBeNull();
      expect(obj!.text()).toBe("content");
    });

    test("creates actual files on disk", async () => {
      await storage.put("disk-file.txt", "on disk");

      expect(existsSync(`${testDir}/disk-file.txt`)).toBe(true);
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
      await storage.put("meta.txt", "metadata test");

      const obj = await storage.get("meta.txt");

      expect(obj!.metadata.key).toBe("meta.txt");
      expect(obj!.metadata.size).toBe(13);
      expect(obj!.metadata.contentType).toBe("text/plain");
      expect(obj!.metadata.lastModified).toBeInstanceOf(Date);
    });
  });

  describe("delete", () => {
    test("removes a file", async () => {
      await storage.put("to-delete.txt", "goodbye");
      await storage.delete("to-delete.txt");

      const obj = await storage.get("to-delete.txt");
      expect(obj).toBeNull();
      expect(existsSync(`${testDir}/to-delete.txt`)).toBe(false);
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
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const text = new TextDecoder().decode(
        chunks.reduce((acc, chunk) => {
          const result = new Uint8Array(acc.length + chunk.length);
          result.set(acc);
          result.set(chunk, acc.length);
          return result;
        }, new Uint8Array(0))
      );

      expect(text).toBe("streamed data");
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
  });

  describe("getUrl", () => {
    test("returns null when urlMode is 'none' (default)", async () => {
      await storage.put("url.txt", "content");

      const url = await storage.getUrl("url.txt");
      expect(url).toBeNull();
    });

    test("returns data URL when urlMode is 'data'", async () => {
      const dataStorage = new LocalStorageProvider({
        baseDir: testDir,
        urlMode: "data",
      });

      await dataStorage.put("url.txt", "url content");

      const url = await dataStorage.getUrl("url.txt");

      expect(url).not.toBeNull();
      expect(url).toMatch(/^data:/);
      expect(url).toContain("base64");

      // Verify content
      const base64 = url!.split(",")[1]!;
      const decoded = Buffer.from(base64, "base64").toString();
      expect(decoded).toBe("url content");
    });

    test("returns null for non-existent key with data mode", async () => {
      const dataStorage = new LocalStorageProvider({
        baseDir: testDir,
        urlMode: "data",
      });

      const url = await dataStorage.getUrl("non-existent");
      expect(url).toBeNull();
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

    test("lists all files from root", async () => {
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

    test("lists files in subdirectory", async () => {
      const entries = [];
      for await (const entry of storage.list("docs")) {
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

    test("entries have correct metadata", async () => {
      const entries = [];
      for await (const entry of storage.list("package.json")) {
        entries.push(entry);
      }

      expect(entries).toHaveLength(1);
      expect(entries[0]!.key).toBe("package.json");
      expect(entries[0]!.size).toBe(7); // "package"
      expect(entries[0]!.lastModified).toBeInstanceOf(Date);
    });
  });

  describe("path security", () => {
    test("prevents path traversal with ..", async () => {
      await expect(
        storage.put("/../../../etc/passwd", "hacked")
      ).rejects.toThrow("Invalid key");
    });

    test("prevents path traversal on get", async () => {
      await expect(storage.get("/../../../etc/passwd")).rejects.toThrow(
        "Invalid key"
      );
    });

    test("prevents path traversal from nested path", async () => {
      // Path traversal from nested location fails
      await expect(
        storage.put("foo/../../bar", "hacked")
      ).rejects.toThrow("Invalid key");
    });

    test("allows URL-encoded characters as literal filenames", async () => {
      // URL-encoded characters are treated as literal characters, not decoded
      // This creates a file with literal "%2F" in the name
      await storage.put("safe%2Ffile.txt", "content");

      const obj = await storage.get("safe%2Ffile.txt");
      expect(obj!.text()).toBe("content");
    });
  });

  describe("content type inference", () => {
    test("infers content type from extension", async () => {
      await storage.put("image.png", new Uint8Array([1, 2, 3]));
      await storage.put("script.js", "console.log()");
      await storage.put("model.ifc", "IFC content");

      const png = await storage.get("image.png");
      const js = await storage.get("script.js");
      const ifc = await storage.get("model.ifc");

      expect(png!.metadata.contentType).toBe("image/png");
      expect(js!.metadata.contentType).toBe("text/javascript");
      expect(ifc!.metadata.contentType).toBe("application/x-step");
    });
  });

  describe("large files", () => {
    test("handles large binary files", async () => {
      // 1MB of random data
      const size = 1024 * 1024;
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        data[i] = i % 256;
      }

      await storage.put("large.bin", data);

      const obj = await storage.get("large.bin");
      expect(obj!.data.length).toBe(size);
      expect(obj!.data[0]).toBe(0);
      expect(obj!.data[255]).toBe(255);
      expect(obj!.data[256]).toBe(0);
    });
  });

  describe("dispose", () => {
    test("completes without error", async () => {
      await storage.put("file.txt", "content");
      await expect(storage.dispose()).resolves.toBeUndefined();
    });
  });
});
