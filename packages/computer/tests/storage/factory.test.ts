import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  createStorageProvider,
  createStorageProviderFromEnv,
} from "../../src/storage/create";
import { LocalStorageProvider } from "../../src/storage/providers/local";
import { MemoryStorageProvider } from "../../src/storage/providers/memory";
import { S3StorageProvider } from "../../src/storage/providers/s3";
import { rm, mkdir } from "node:fs/promises";

describe("createStorageProvider", () => {
  const testDir = "/tmp/factory-test-" + Date.now();

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("creates LocalStorageProvider for type 'local'", () => {
    const storage = createStorageProvider({
      type: "local",
      baseDir: testDir,
    });

    expect(storage).toBeInstanceOf(LocalStorageProvider);
    expect(storage.type).toBe("local");
  });

  test("creates LocalStorageProvider with urlMode option", () => {
    const storage = createStorageProvider({
      type: "local",
      baseDir: testDir,
      urlMode: "data",
    });

    expect(storage).toBeInstanceOf(LocalStorageProvider);
  });

  test("creates MemoryStorageProvider for type 'memory'", () => {
    const storage = createStorageProvider({ type: "memory" });

    expect(storage).toBeInstanceOf(MemoryStorageProvider);
    expect(storage.type).toBe("memory");
  });

  test("creates S3StorageProvider for type 's3'", () => {
    const storage = createStorageProvider({
      type: "s3",
      bucket: "test-bucket",
      accessKeyId: "key",
      secretAccessKey: "secret",
    });

    expect(storage).toBeInstanceOf(S3StorageProvider);
    expect(storage.type).toBe("s3");
  });

  test("creates S3StorageProvider with all options", () => {
    const storage = createStorageProvider({
      type: "s3",
      bucket: "test-bucket",
      accessKeyId: "key",
      secretAccessKey: "secret",
      endpoint: "https://s3.example.com",
      region: "us-west-2",
      prefix: "my-prefix",
    });

    expect(storage).toBeInstanceOf(S3StorageProvider);
    expect((storage as S3StorageProvider).bucket).toBe("test-bucket");
  });

  test("throws for unknown type", () => {
    expect(() =>
      createStorageProvider({ type: "unknown" as any })
    ).toThrow("Unknown storage provider type: unknown");
  });
});

describe("createStorageProviderFromEnv", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original env
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith("STORAGE_") || key.startsWith("S3_")) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  test("defaults to local storage", () => {
    process.env.STORAGE_LOCAL_BASE_DIR = "/tmp/env-test";

    const storage = createStorageProviderFromEnv();

    expect(storage).toBeInstanceOf(LocalStorageProvider);
  });

  test("creates local storage from env", () => {
    process.env.STORAGE_TYPE = "local";
    process.env.STORAGE_LOCAL_BASE_DIR = "/tmp/env-test";
    process.env.STORAGE_LOCAL_URL_MODE = "data";

    const storage = createStorageProviderFromEnv();

    expect(storage).toBeInstanceOf(LocalStorageProvider);
  });

  test("throws when local baseDir is missing", () => {
    process.env.STORAGE_TYPE = "local";
    delete process.env.STORAGE_LOCAL_BASE_DIR;

    expect(() => createStorageProviderFromEnv()).toThrow(
      "STORAGE_LOCAL_BASE_DIR environment variable is required"
    );
  });

  test("creates memory storage from env", () => {
    process.env.STORAGE_TYPE = "memory";

    const storage = createStorageProviderFromEnv();

    expect(storage).toBeInstanceOf(MemoryStorageProvider);
  });

  test("creates S3 storage from env", () => {
    process.env.STORAGE_TYPE = "s3";
    process.env.STORAGE_S3_BUCKET = "env-bucket";
    process.env.STORAGE_S3_ENDPOINT = "https://s3.example.com";
    process.env.STORAGE_S3_REGION = "eu-west-1";
    process.env.STORAGE_S3_PREFIX = "env-prefix";
    process.env.S3_ACCESS_KEY_ID = "env-key";
    process.env.S3_SECRET_ACCESS_KEY = "env-secret";

    const storage = createStorageProviderFromEnv();

    expect(storage).toBeInstanceOf(S3StorageProvider);
    expect((storage as S3StorageProvider).bucket).toBe("env-bucket");
  });

  test("throws when S3 bucket is missing", () => {
    process.env.STORAGE_TYPE = "s3";
    delete process.env.STORAGE_S3_BUCKET;

    expect(() => createStorageProviderFromEnv()).toThrow(
      "STORAGE_S3_BUCKET environment variable is required"
    );
  });

  test("throws for unknown type in env", () => {
    process.env.STORAGE_TYPE = "invalid";

    expect(() => createStorageProviderFromEnv()).toThrow(
      "Unknown STORAGE_TYPE: invalid"
    );
  });
});
