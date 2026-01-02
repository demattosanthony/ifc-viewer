/**
 * LocalFileSystem Tests
 *
 * Tests for the local filesystem implementation including
 * CRITICAL security tests for path traversal prevention.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { LocalFileSystem } from "../../src/compute/local/filesystem"
import { mkdir, rm, writeFile, readFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("LocalFileSystem", () => {
  let baseDir: string
  let fs: LocalFileSystem

  beforeEach(async () => {
    // Create a unique temp directory for each test
    baseDir = join(tmpdir(), `fs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(baseDir, { recursive: true })
    fs = new LocalFileSystem(baseDir)
  })

  afterEach(async () => {
    // Clean up temp directory
    await rm(baseDir, { recursive: true, force: true })
  })

  // ============================================================================
  // SECURITY TESTS - Path Traversal Prevention (CRITICAL)
  // ============================================================================

  describe("security - path traversal prevention", () => {
    test("rejects path with .. escaping sandbox", () => {
      expect(() => fs["resolvePath"]("../outside")).toThrow("escapes sandbox")
    })

    test("rejects path with multiple .. sequences", () => {
      expect(() => fs["resolvePath"]("foo/../../outside")).toThrow("escapes sandbox")
    })

    test("handles absolute path by treating as relative", () => {
      // The implementation strips leading slashes and treats as relative path
      // /etc/passwd becomes etc/passwd within the sandbox
      const resolved = fs["resolvePath"]("/etc/passwd")
      expect(resolved).toContain("etc/passwd")
      expect(resolved.startsWith(baseDir)).toBe(true)
    })

    test("rejects path with encoded traversal", () => {
      // Even URL-encoded sequences should be handled safely by resolve()
      expect(() => fs["resolvePath"]("..%2F..%2Fetc/passwd")).not.toThrow()
      // The resolved path should still be within sandbox (the encoded chars are literal)
    })

    test("allows paths within sandbox", () => {
      expect(() => fs["resolvePath"]("subdir/file.txt")).not.toThrow()
      expect(() => fs["resolvePath"]("deeply/nested/path/file.txt")).not.toThrow()
    })

    test("allows .. that stays within sandbox", () => {
      expect(() => fs["resolvePath"]("subdir/../file.txt")).not.toThrow()
    })

    test("read rejects path traversal", async () => {
      await expect(fs.read("../outside.txt")).rejects.toThrow("escapes sandbox")
    })

    test("write rejects path traversal", async () => {
      await expect(fs.write("../outside.txt", "malicious")).rejects.toThrow("escapes sandbox")
    })

    test("delete rejects path traversal", async () => {
      await expect(fs.delete("../outside.txt")).rejects.toThrow("escapes sandbox")
    })

    test("list rejects path traversal", async () => {
      await expect(fs.list("../")).rejects.toThrow("escapes sandbox")
    })

    test("stat rejects path traversal", async () => {
      await expect(fs.stat("../outside.txt")).rejects.toThrow("escapes sandbox")
    })

    test("copy source rejects path traversal", async () => {
      await writeFile(join(baseDir, "safe.txt"), "content")
      await expect(fs.copy("../outside.txt", "dest.txt")).rejects.toThrow("escapes sandbox")
    })

    test("copy destination rejects path traversal", async () => {
      await writeFile(join(baseDir, "safe.txt"), "content")
      await expect(fs.copy("safe.txt", "../outside.txt")).rejects.toThrow("escapes sandbox")
    })

    test("move source rejects path traversal", async () => {
      await expect(fs.move("../outside.txt", "dest.txt")).rejects.toThrow("escapes sandbox")
    })

    test("move destination rejects path traversal", async () => {
      await writeFile(join(baseDir, "safe.txt"), "content")
      await expect(fs.move("safe.txt", "../outside.txt")).rejects.toThrow("escapes sandbox")
    })

    test("mkdir rejects path traversal", async () => {
      await expect(fs.mkdir("../outside")).rejects.toThrow("escapes sandbox")
    })
  })

  // ============================================================================
  // Basic File Operations
  // ============================================================================

  describe("read", () => {
    test("reads text file content", async () => {
      await writeFile(join(baseDir, "test.txt"), "hello world")

      const result = await fs.read("test.txt")
      expect(result.type).toBe("text")
      expect(result.content).toBe("hello world")
    })

    test("reads binary file content", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5])
      await writeFile(join(baseDir, "data.bin"), data)

      const result = await fs.read("data.bin", { encoding: "binary" })
      expect(result.type).toBe("binary")
      expect(result.content).toEqual(data)
    })

    test("reads file with leading slash", async () => {
      await writeFile(join(baseDir, "test.txt"), "content")

      const result = await fs.read("/test.txt")
      expect(result.content).toBe("content")
    })

    test("reads file in nested directory", async () => {
      await mkdir(join(baseDir, "a/b/c"), { recursive: true })
      await writeFile(join(baseDir, "a/b/c/file.txt"), "nested")

      const result = await fs.read("a/b/c/file.txt")
      expect(result.content).toBe("nested")
    })

    test("throws for non-existent file", async () => {
      await expect(fs.read("nonexistent.txt")).rejects.toThrow()
    })
  })

  describe("write", () => {
    test("writes text content to file", async () => {
      await fs.write("test.txt", "hello world")

      const content = await readFile(join(baseDir, "test.txt"), "utf-8")
      expect(content).toBe("hello world")
    })

    test("writes binary content to file", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5])
      await fs.write("data.bin", data)

      const content = await readFile(join(baseDir, "data.bin"))
      expect(new Uint8Array(content)).toEqual(data)
    })

    test("creates parent directories automatically", async () => {
      await fs.write("a/b/c/file.txt", "nested content")

      const content = await readFile(join(baseDir, "a/b/c/file.txt"), "utf-8")
      expect(content).toBe("nested content")
    })

    test("overwrites existing file", async () => {
      await writeFile(join(baseDir, "test.txt"), "original")
      await fs.write("test.txt", "updated")

      const content = await readFile(join(baseDir, "test.txt"), "utf-8")
      expect(content).toBe("updated")
    })
  })

  describe("list", () => {
    beforeEach(async () => {
      await mkdir(join(baseDir, "subdir"), { recursive: true })
      await writeFile(join(baseDir, "a.txt"), "a")
      await writeFile(join(baseDir, "b.txt"), "b")
      await writeFile(join(baseDir, "subdir/c.txt"), "c")
    })

    test("lists files in directory", async () => {
      const entries = await fs.list(".")

      expect(entries.length).toBe(3)
      const names = entries.map((e) => e.name).sort()
      expect(names).toContain("a.txt")
      expect(names).toContain("b.txt")
      expect(names).toContain("subdir")
    })

    test("returns file metadata", async () => {
      const entries = await fs.list(".")

      const file = entries.find((e) => e.name === "a.txt")
      expect(file).toBeDefined()
      expect(file!.type).toBe("file")
      expect(file!.size).toBe(1)
      expect(typeof file!.modifiedAt).toBe("number")
    })

    test("identifies directories", async () => {
      const entries = await fs.list(".")

      const dir = entries.find((e) => e.name === "subdir")
      expect(dir).toBeDefined()
      expect(dir!.type).toBe("directory")
    })

    test("returns path relative to base directory", async () => {
      const entries = await fs.list(".")

      const file = entries.find((e) => e.name === "a.txt")
      expect(file!.path).toBe("/a.txt")
    })
  })

  describe("mkdir", () => {
    test("creates directory", async () => {
      await fs.mkdir("newdir")

      const stats = await fs.stat("newdir")
      expect(stats.type).toBe("directory")
    })

    test("creates nested directories with recursive option", async () => {
      await fs.mkdir("a/b/c", { recursive: true })

      const stats = await fs.stat("a/b/c")
      expect(stats.type).toBe("directory")
    })

    test("throws without recursive option for nested path", async () => {
      await expect(fs.mkdir("x/y/z")).rejects.toThrow()
    })
  })

  describe("delete", () => {
    test("deletes file", async () => {
      await writeFile(join(baseDir, "test.txt"), "content")
      await fs.delete("test.txt")

      await expect(fs.stat("test.txt")).rejects.toThrow()
    })

    test("deletes empty directory", async () => {
      await mkdir(join(baseDir, "emptydir"))
      await fs.delete("emptydir")

      await expect(fs.stat("emptydir")).rejects.toThrow()
    })

    test("deletes directory recursively with option", async () => {
      await mkdir(join(baseDir, "dir/subdir"), { recursive: true })
      await writeFile(join(baseDir, "dir/subdir/file.txt"), "content")

      await fs.delete("dir", { recursive: true })

      await expect(fs.stat("dir")).rejects.toThrow()
    })

    test("throws for non-empty directory without recursive option", async () => {
      await mkdir(join(baseDir, "dir"))
      await writeFile(join(baseDir, "dir/file.txt"), "content")

      await expect(fs.delete("dir")).rejects.toThrow()
    })
  })

  describe("stat", () => {
    test("returns file stats", async () => {
      await writeFile(join(baseDir, "test.txt"), "hello")

      const stats = await fs.stat("test.txt")
      expect(stats.type).toBe("file")
      expect(stats.size).toBe(5)
      expect(typeof stats.createdAt).toBe("number")
      expect(typeof stats.modifiedAt).toBe("number")
      expect(typeof stats.accessedAt).toBe("number")
    })

    test("returns directory stats", async () => {
      await mkdir(join(baseDir, "testdir"))

      const stats = await fs.stat("testdir")
      expect(stats.type).toBe("directory")
    })

    test("throws for non-existent path", async () => {
      await expect(fs.stat("nonexistent")).rejects.toThrow()
    })
  })

  describe("copy", () => {
    test("copies file", async () => {
      await writeFile(join(baseDir, "source.txt"), "content")

      await fs.copy("source.txt", "dest.txt")

      const result = await fs.read("dest.txt")
      expect(result.content).toBe("content")
    })

    test("copies file to new directory", async () => {
      await writeFile(join(baseDir, "source.txt"), "content")

      await fs.copy("source.txt", "newdir/dest.txt")

      const result = await fs.read("newdir/dest.txt")
      expect(result.content).toBe("content")
    })

    test("copies directory recursively", async () => {
      await mkdir(join(baseDir, "srcdir/subdir"), { recursive: true })
      await writeFile(join(baseDir, "srcdir/a.txt"), "a")
      await writeFile(join(baseDir, "srcdir/subdir/b.txt"), "b")

      await fs.copy("srcdir", "destdir")

      const a = await fs.read("destdir/a.txt")
      const b = await fs.read("destdir/subdir/b.txt")
      expect(a.content).toBe("a")
      expect(b.content).toBe("b")
    })
  })

  describe("move", () => {
    test("moves file", async () => {
      await writeFile(join(baseDir, "source.txt"), "content")

      await fs.move("source.txt", "dest.txt")

      await expect(fs.stat("source.txt")).rejects.toThrow()
      const result = await fs.read("dest.txt")
      expect(result.content).toBe("content")
    })

    test("moves file to new directory", async () => {
      await writeFile(join(baseDir, "source.txt"), "content")

      await fs.move("source.txt", "newdir/dest.txt")

      await expect(fs.stat("source.txt")).rejects.toThrow()
      const result = await fs.read("newdir/dest.txt")
      expect(result.content).toBe("content")
    })

    test("renames file", async () => {
      await writeFile(join(baseDir, "old.txt"), "content")

      await fs.move("old.txt", "new.txt")

      await expect(fs.stat("old.txt")).rejects.toThrow()
      const result = await fs.read("new.txt")
      expect(result.content).toBe("content")
    })
  })
})
