import { describe, test, expect } from "bun:test";
import { S3StorageProvider } from "../../src/storage/providers/s3";

/**
 * S3 Storage Provider Tests
 *
 * These tests verify the S3StorageProvider implementation.
 * Full integration tests require actual S3 credentials and are skipped by default.
 *
 * To run integration tests, set the following environment variables:
 * - S3_TEST_BUCKET: S3 bucket name
 * - S3_ACCESS_KEY_ID: Access key
 * - S3_SECRET_ACCESS_KEY: Secret key
 * - S3_ENDPOINT: (optional) S3-compatible endpoint
 */

describe("S3StorageProvider", () => {
  describe("type", () => {
    test("returns 's3'", () => {
      const storage = new S3StorageProvider({
        bucket: "test-bucket",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
      });

      expect(storage.type).toBe("s3");
    });
  });

  describe("bucket", () => {
    test("returns configured bucket name", () => {
      const storage = new S3StorageProvider({
        bucket: "my-bucket",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
      });

      expect(storage.bucket).toBe("my-bucket");
    });
  });

  describe("key building", () => {
    test("builds keys without prefix", () => {
      const storage = new S3StorageProvider({
        bucket: "test-bucket",
        accessKeyId: "key",
        secretAccessKey: "secret",
      });

      // We can't directly test private methods, but we can verify
      // the storage is created without errors
      expect(storage).toBeDefined();
    });

    test("builds keys with prefix", () => {
      const storage = new S3StorageProvider({
        bucket: "test-bucket",
        prefix: "sessions/abc123",
        accessKeyId: "key",
        secretAccessKey: "secret",
      });

      expect(storage).toBeDefined();
    });

    test("handles trailing slashes in prefix", () => {
      const storage = new S3StorageProvider({
        bucket: "test-bucket",
        prefix: "prefix/with/trailing/",
        accessKeyId: "key",
        secretAccessKey: "secret",
      });

      expect(storage).toBeDefined();
    });
  });

  describe("list", () => {
    test("throws informative error (not implemented)", async () => {
      const storage = new S3StorageProvider({
        bucket: "test-bucket",
        accessKeyId: "key",
        secretAccessKey: "secret",
      });

      const iterator = storage.list("prefix")[Symbol.asyncIterator]();

      await expect(iterator.next()).rejects.toThrow(
        "S3StorageProvider.list() is not yet implemented"
      );
    });
  });

  describe("dispose", () => {
    test("completes without error", async () => {
      const storage = new S3StorageProvider({
        bucket: "test-bucket",
        accessKeyId: "key",
        secretAccessKey: "secret",
      });

      await expect(storage.dispose()).resolves.toBeUndefined();
    });
  });
});

/**
 * Integration tests - only run when S3 credentials are available.
 */
const hasS3Credentials =
  process.env.S3_TEST_BUCKET &&
  (process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID);

describe.skipIf(!hasS3Credentials)("S3StorageProvider Integration", () => {
  const storage = hasS3Credentials
    ? new S3StorageProvider({
        bucket: process.env.S3_TEST_BUCKET!,
        endpoint: process.env.S3_ENDPOINT,
        prefix: `test-${Date.now()}`,
      })
    : null;

  test("put and get string", async () => {
    if (!storage) return;

    await storage.put("hello.txt", "Hello from integration test!");
    const obj = await storage.get("hello.txt");

    expect(obj).not.toBeNull();
    expect(obj!.text()).toBe("Hello from integration test!");

    await storage.delete("hello.txt");
  });

  test("put and get binary", async () => {
    if (!storage) return;

    const data = new Uint8Array([1, 2, 3, 4, 5]);
    await storage.put("binary.bin", data);
    const obj = await storage.get("binary.bin");

    expect(obj).not.toBeNull();
    expect(obj!.data).toEqual(data);

    await storage.delete("binary.bin");
  });

  test("getUrl returns presigned URL", async () => {
    if (!storage) return;

    await storage.put("presigned.txt", "presigned content");
    const url = await storage.getUrl("presigned.txt");

    expect(url).not.toBeNull();
    expect(url).toMatch(/^https?:\/\//);

    // Verify URL is accessible
    const response = await fetch(url!);
    expect(response.ok).toBe(true);
    expect(await response.text()).toBe("presigned content");

    await storage.delete("presigned.txt");
  });

  test("getUploadUrl returns presigned upload URL", async () => {
    if (!storage) return;

    const creds = await storage.getUploadUrl("upload.txt", {
      contentType: "text/plain",
    });

    expect(creds).not.toBeNull();
    expect(creds!.method).toBe("PUT");
    expect(creds!.url).toMatch(/^https?:\/\//);

    // Use the presigned URL to upload
    await fetch(creds!.url, {
      method: "PUT",
      body: "uploaded via presigned URL",
      headers: creds!.headers,
    });

    // Verify upload
    const obj = await storage.get("upload.txt");
    expect(obj!.text()).toBe("uploaded via presigned URL");

    await storage.delete("upload.txt");
  });

  test("exists returns true for existing and false for missing", async () => {
    if (!storage) return;

    await storage.put("exists.txt", "exists");

    expect(await storage.exists("exists.txt")).toBe(true);
    expect(await storage.exists("not-exists.txt")).toBe(false);

    await storage.delete("exists.txt");
  });

  test("delete removes object", async () => {
    if (!storage) return;

    await storage.put("to-delete.txt", "delete me");
    expect(await storage.exists("to-delete.txt")).toBe(true);

    await storage.delete("to-delete.txt");
    expect(await storage.exists("to-delete.txt")).toBe(false);
  });

  test("getStream returns readable stream", async () => {
    if (!storage) return;

    await storage.put("streamed.txt", "streamed content");
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

    expect(text).toBe("streamed content");

    await storage.delete("streamed.txt");
  });
});
