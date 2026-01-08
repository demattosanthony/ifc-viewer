/**
 * ChangeTracker Tests
 *
 * Tests for the file change tracking system used to sync
 * compute environment changes to project storage.
 */

import { describe, test, expect, beforeEach } from "bun:test"
import {
  createChangeTracker,
  type ChangeTracker,
} from "../../src/services/change-tracker"
import type { Computer } from "../../src/ports"
import {
  createMockFileSystem,
  createMockComputer,
  createMockStorage,
} from "../mocks"

describe("ChangeTracker", () => {
  let fs: ReturnType<typeof createMockFileSystem>
  let computer: Computer
  let storage: ReturnType<typeof createMockStorage>
  let tracker: ChangeTracker

  beforeEach(() => {
    fs = createMockFileSystem()
    computer = createMockComputer(fs)
    storage = createMockStorage()
    tracker = createChangeTracker({
      computer,
      storage,
      projectId: "test-project",
    })
  })

  describe("record", () => {
    test("records a create change", () => {
      tracker.record({ type: "create", path: "src/foo.ts", source: "tool" })

      const pending = tracker.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0]!.type).toBe("create")
      expect(pending[0]!.path).toBe("src/foo.ts")
      expect(pending[0]!.source).toBe("tool")
    })

    test("records an update change", () => {
      tracker.record({ type: "update", path: "src/foo.ts", source: "tool" })

      const pending = tracker.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0]!.type).toBe("update")
    })

    test("records a delete change", () => {
      tracker.record({ type: "delete", path: "src/foo.ts", source: "tool" })

      const pending = tracker.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0]!.type).toBe("delete")
    })

    test("records a move change", () => {
      tracker.record({
        type: "move",
        path: "src/bar.ts",
        oldPath: "src/foo.ts",
        source: "tool",
      })

      const pending = tracker.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0]!.type).toBe("move")
      expect(pending[0]!.path).toBe("src/bar.ts")
      expect(pending[0]!.oldPath).toBe("src/foo.ts")
    })

    test("normalizes paths with leading ./", () => {
      tracker.record({ type: "create", path: "./src/foo.ts", source: "tool" })

      const pending = tracker.getPending()
      expect(pending[0]!.path).toBe("src/foo.ts")
    })

    test("normalizes paths with leading /", () => {
      tracker.record({ type: "create", path: "/src/foo.ts", source: "tool" })

      const pending = tracker.getPending()
      expect(pending[0]!.path).toBe("src/foo.ts")
    })

    test("overwrites previous change for same path", () => {
      tracker.record({ type: "create", path: "src/foo.ts", source: "tool" })
      tracker.record({ type: "update", path: "src/foo.ts", source: "tool" })

      const pending = tracker.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0]!.type).toBe("update")
    })

    test("removes old path from pending on move", () => {
      tracker.record({ type: "create", path: "src/foo.ts", source: "tool" })
      tracker.record({
        type: "move",
        path: "src/bar.ts",
        oldPath: "src/foo.ts",
        source: "tool",
      })

      const pending = tracker.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0]!.path).toBe("src/bar.ts")
    })

    test("ignores node_modules paths", () => {
      tracker.record({
        type: "create",
        path: "node_modules/foo/index.js",
        source: "tool",
      })

      expect(tracker.getPending()).toHaveLength(0)
    })

    test("ignores .git paths", () => {
      tracker.record({ type: "create", path: ".git/config", source: "tool" })

      expect(tracker.getPending()).toHaveLength(0)
    })

    test("ignores __pycache__ paths", () => {
      tracker.record({
        type: "create",
        path: "__pycache__/foo.pyc",
        source: "tool",
      })

      expect(tracker.getPending()).toHaveLength(0)
    })

    test("ignores .pyc files", () => {
      tracker.record({ type: "create", path: "src/foo.pyc", source: "tool" })

      expect(tracker.getPending()).toHaveLength(0)
    })

    test("ignores .log files", () => {
      tracker.record({ type: "create", path: "debug.log", source: "tool" })

      expect(tracker.getPending()).toHaveLength(0)
    })
  })

  describe("snapshot and detectChanges", () => {
    test("detects new files", async () => {
      const before = await tracker.snapshot()

      fs._files.set("src/new.ts", {
        content: new TextEncoder().encode("new content"),
        modifiedAt: Date.now(),
      })

      const changes = await tracker.detectChanges(before)
      expect(changes).toHaveLength(1)
      expect(changes[0]!.type).toBe("create")
      expect(changes[0]!.path).toBe("src/new.ts")
      expect(changes[0]!.source).toBe("terminal")
    })

    test("detects modified files", async () => {
      fs._files.set("src/existing.ts", {
        content: new TextEncoder().encode("original"),
        modifiedAt: 1000,
      })

      const before = await tracker.snapshot()

      fs._files.set("src/existing.ts", {
        content: new TextEncoder().encode("modified"),
        modifiedAt: 2000,
      })

      const changes = await tracker.detectChanges(before)
      expect(changes).toHaveLength(1)
      expect(changes[0]!.type).toBe("update")
      expect(changes[0]!.path).toBe("src/existing.ts")
    })

    test("detects deleted files", async () => {
      fs._files.set("src/toDelete.ts", {
        content: new TextEncoder().encode("content"),
        modifiedAt: Date.now(),
      })

      const before = await tracker.snapshot()

      fs._files.delete("src/toDelete.ts")

      const changes = await tracker.detectChanges(before)
      expect(changes).toHaveLength(1)
      expect(changes[0]!.type).toBe("delete")
      expect(changes[0]!.path).toBe("src/toDelete.ts")
    })

    test("detects multiple changes", async () => {
      fs._files.set("src/existing.ts", {
        content: new TextEncoder().encode("original"),
        modifiedAt: 1000,
      })
      fs._files.set("src/toDelete.ts", {
        content: new TextEncoder().encode("content"),
        modifiedAt: 1000,
      })

      const before = await tracker.snapshot()

      fs._files.set("src/new.ts", {
        content: new TextEncoder().encode("new"),
        modifiedAt: 2000,
      })
      fs._files.set("src/existing.ts", {
        content: new TextEncoder().encode("modified"),
        modifiedAt: 2000,
      })
      fs._files.delete("src/toDelete.ts")

      const changes = await tracker.detectChanges(before)
      expect(changes).toHaveLength(3)

      const types = changes.map((c) => c.type).sort()
      expect(types).toEqual(["create", "delete", "update"])
    })

    test("ignores node_modules in snapshots", async () => {
      fs._files.set("node_modules/foo/index.js", {
        content: new TextEncoder().encode("module"),
        modifiedAt: 1000,
      })
      fs._files.set("src/app.ts", {
        content: new TextEncoder().encode("app"),
        modifiedAt: 1000,
      })

      const before = await tracker.snapshot()

      // Modify both
      fs._files.set("node_modules/foo/index.js", {
        content: new TextEncoder().encode("modified module"),
        modifiedAt: 2000,
      })
      fs._files.set("src/app.ts", {
        content: new TextEncoder().encode("modified app"),
        modifiedAt: 2000,
      })

      const changes = await tracker.detectChanges(before)
      // Should only detect src/app.ts change, not node_modules
      expect(changes).toHaveLength(1)
      expect(changes[0]!.path).toBe("src/app.ts")
    })
  })

  describe("persist", () => {
    test("persists create changes to storage", async () => {
      fs._files.set("src/foo.ts", {
        content: new TextEncoder().encode("content"),
        modifiedAt: Date.now(),
      })
      tracker.record({ type: "create", path: "src/foo.ts", source: "tool" })

      const result = await tracker.persist()

      expect(result.persisted).toEqual(["src/foo.ts"])
      expect(storage._data.has("projects/test-project/src/foo.ts")).toBe(true)
      expect(tracker.getPending()).toHaveLength(0)
    })

    test("persists update changes to storage", async () => {
      fs._files.set("src/foo.ts", {
        content: new TextEncoder().encode("updated content"),
        modifiedAt: Date.now(),
      })
      tracker.record({ type: "update", path: "src/foo.ts", source: "tool" })

      await tracker.persist()

      const stored = storage._data.get("projects/test-project/src/foo.ts")
      expect(new TextDecoder().decode(stored!)).toBe("updated content")
    })

    test("persists delete changes to storage", async () => {
      storage._data.set(
        "projects/test-project/src/foo.ts",
        new TextEncoder().encode("content")
      )
      tracker.record({ type: "delete", path: "src/foo.ts", source: "tool" })

      await tracker.persist()

      expect(storage._data.has("projects/test-project/src/foo.ts")).toBe(false)
    })

    test("persists move changes to storage", async () => {
      storage._data.set(
        "projects/test-project/src/old.ts",
        new TextEncoder().encode("content")
      )
      fs._files.set("src/new.ts", {
        content: new TextEncoder().encode("content"),
        modifiedAt: Date.now(),
      })
      tracker.record({
        type: "move",
        path: "src/new.ts",
        oldPath: "src/old.ts",
        source: "tool",
      })

      await tracker.persist()

      expect(storage._data.has("projects/test-project/src/old.ts")).toBe(false)
      expect(storage._data.has("projects/test-project/src/new.ts")).toBe(true)
    })

    test("persists only specified paths", async () => {
      fs._files.set("src/a.ts", {
        content: new TextEncoder().encode("a"),
        modifiedAt: Date.now(),
      })
      fs._files.set("src/b.ts", {
        content: new TextEncoder().encode("b"),
        modifiedAt: Date.now(),
      })
      tracker.record({ type: "create", path: "src/a.ts", source: "tool" })
      tracker.record({ type: "create", path: "src/b.ts", source: "tool" })

      const result = await tracker.persist(["src/a.ts"])

      expect(result.persisted).toEqual(["src/a.ts"])
      expect(storage._data.has("projects/test-project/src/a.ts")).toBe(true)
      expect(storage._data.has("projects/test-project/src/b.ts")).toBe(false)
      expect(tracker.getPending()).toHaveLength(1)
      expect(tracker.getPending()[0]!.path).toBe("src/b.ts")
    })

    test("clears persisted changes from pending", async () => {
      fs._files.set("src/foo.ts", {
        content: new TextEncoder().encode("content"),
        modifiedAt: Date.now(),
      })
      tracker.record({ type: "create", path: "src/foo.ts", source: "tool" })

      expect(tracker.hasPending()).toBe(true)

      await tracker.persist()

      expect(tracker.hasPending()).toBe(false)
    })
  })

  describe("getChanges", () => {
    test("returns changes for specified paths", () => {
      tracker.record({ type: "create", path: "src/a.ts", source: "tool" })
      tracker.record({ type: "create", path: "src/b.ts", source: "tool" })
      tracker.record({ type: "create", path: "src/c.ts", source: "tool" })

      const changes = tracker.getChanges(["src/a.ts", "src/c.ts"])

      expect(changes).toHaveLength(2)
      expect(changes.map((c) => c.path).sort()).toEqual(["src/a.ts", "src/c.ts"])
    })

    test("returns empty array for non-existent paths", () => {
      tracker.record({ type: "create", path: "src/a.ts", source: "tool" })

      const changes = tracker.getChanges(["src/nonexistent.ts"])

      expect(changes).toHaveLength(0)
    })
  })

  describe("clear", () => {
    test("clears all pending changes", () => {
      tracker.record({ type: "create", path: "src/a.ts", source: "tool" })
      tracker.record({ type: "create", path: "src/b.ts", source: "tool" })

      tracker.clear()

      expect(tracker.getPending()).toHaveLength(0)
    })

    test("clears only specified paths", () => {
      tracker.record({ type: "create", path: "src/a.ts", source: "tool" })
      tracker.record({ type: "create", path: "src/b.ts", source: "tool" })

      tracker.clear(["src/a.ts"])

      expect(tracker.getPending()).toHaveLength(1)
      expect(tracker.getPending()[0]!.path).toBe("src/b.ts")
    })
  })

  describe("hasPending", () => {
    test("returns false when no pending changes", () => {
      expect(tracker.hasPending()).toBe(false)
    })

    test("returns true when there are pending changes", () => {
      tracker.record({ type: "create", path: "src/foo.ts", source: "tool" })

      expect(tracker.hasPending()).toBe(true)
    })

    test("returns false after all changes are cleared", () => {
      tracker.record({ type: "create", path: "src/foo.ts", source: "tool" })
      tracker.clear()

      expect(tracker.hasPending()).toBe(false)
    })
  })

  describe("integration: record + detectChanges", () => {
    test("terminal changes are recorded after detection", async () => {
      const before = await tracker.snapshot()

      // Simulate terminal creating files
      fs._files.set("output/result.txt", {
        content: new TextEncoder().encode("result"),
        modifiedAt: Date.now(),
      })

      const changes = await tracker.detectChanges(before)
      for (const change of changes) {
        tracker.record(change)
      }

      expect(tracker.getPending()).toHaveLength(1)
      expect(tracker.getPending()[0]!.source).toBe("terminal")
    })
  })

  describe("sync", () => {
    test("syncs create change directly to storage without pending", async () => {
      fs._files.set("src/foo.ts", {
        content: new TextEncoder().encode("content"),
        modifiedAt: Date.now(),
      })

      await tracker.sync({ type: "create", path: "src/foo.ts", source: "tool" })

      // File should be in storage
      expect(storage._data.has("projects/test-project/src/foo.ts")).toBe(true)
      const stored = storage._data.get("projects/test-project/src/foo.ts")
      expect(new TextDecoder().decode(stored!)).toBe("content")

      // Should NOT be in pending (sync bypasses pending)
      expect(tracker.getPending()).toHaveLength(0)
    })

    test("syncs update change directly to storage", async () => {
      fs._files.set("src/foo.ts", {
        content: new TextEncoder().encode("updated"),
        modifiedAt: Date.now(),
      })

      await tracker.sync({ type: "update", path: "src/foo.ts", source: "tool" })

      expect(storage._data.has("projects/test-project/src/foo.ts")).toBe(true)
      const stored = storage._data.get("projects/test-project/src/foo.ts")
      expect(new TextDecoder().decode(stored!)).toBe("updated")
    })

    test("syncs delete change directly to storage", async () => {
      storage._data.set(
        "projects/test-project/src/foo.ts",
        new TextEncoder().encode("content")
      )

      await tracker.sync({ type: "delete", path: "src/foo.ts", source: "tool" })

      expect(storage._data.has("projects/test-project/src/foo.ts")).toBe(false)
    })

    test("syncs move change directly to storage", async () => {
      storage._data.set(
        "projects/test-project/src/old.ts",
        new TextEncoder().encode("content")
      )
      fs._files.set("src/new.ts", {
        content: new TextEncoder().encode("content"),
        modifiedAt: Date.now(),
      })

      await tracker.sync({
        type: "move",
        path: "src/new.ts",
        oldPath: "src/old.ts",
        source: "tool",
      })

      expect(storage._data.has("projects/test-project/src/old.ts")).toBe(false)
      expect(storage._data.has("projects/test-project/src/new.ts")).toBe(true)
    })

    test("ignores node_modules paths", async () => {
      fs._files.set("node_modules/foo/index.js", {
        content: new TextEncoder().encode("module"),
        modifiedAt: Date.now(),
      })

      await tracker.sync({
        type: "create",
        path: "node_modules/foo/index.js",
        source: "terminal",
      })

      // Should NOT be synced to storage (ignored)
      expect(storage._data.has("projects/test-project/node_modules/foo/index.js")).toBe(false)
    })

    test("normalizes paths before syncing", async () => {
      fs._files.set("src/foo.ts", {
        content: new TextEncoder().encode("content"),
        modifiedAt: Date.now(),
      })

      await tracker.sync({ type: "create", path: "./src/foo.ts", source: "tool" })

      expect(storage._data.has("projects/test-project/src/foo.ts")).toBe(true)
    })
  })
})
