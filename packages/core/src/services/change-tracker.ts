/**
 * Change Tracker
 *
 * Tracks file changes in compute environment for deferred persistence to storage.
 * Changes from file tools are recorded directly. Changes from terminal commands
 * are detected via snapshot diffing.
 */

import type { Computer, Storage } from "../ports"

// ============================================================================
// Types
// ============================================================================

export type ChangeType = "create" | "update" | "delete" | "move"
export type ChangeSource = "tool" | "terminal"

export interface FileChange {
  type: ChangeType
  path: string
  oldPath?: string // for moves
  source: ChangeSource
  timestamp: Date
}

export interface FileSnapshot {
  /** Map of path -> { modifiedAt, size } */
  files: Map<string, { modifiedAt: number; size: number }>
}

export interface ChangeTracker {
  /** Record a change for deferred persistence (use sync() for immediate) */
  record(change: Omit<FileChange, "timestamp">): void

  /**
   * Sync a change immediately to storage.
   * Use this for user-visible changes that should appear in the file browser right away.
   * Does NOT add to pending queue - the change is persisted directly.
   */
  sync(change: Omit<FileChange, "timestamp">): Promise<void>

  /** Take a snapshot of current file state (before terminal command) */
  snapshot(): Promise<FileSnapshot>

  /** Detect changes by comparing snapshots (after terminal command) */
  detectChanges(before: FileSnapshot): Promise<FileChange[]>

  /** Get all pending (unsynced) changes */
  getPending(): FileChange[]

  /** Get pending changes for specific paths */
  getChanges(paths: string[]): FileChange[]

  /** Persist pending changes to storage */
  persist(paths?: string[]): Promise<{ persisted: string[] }>

  /** Clear pending changes (after persist) */
  clear(paths?: string[]): void

  /** Check if there are any pending changes */
  hasPending(): boolean
}

// ============================================================================
// Ignore patterns for files we never track
// ============================================================================

const IGNORED_PATTERNS = [
  /^node_modules\//,
  /^\.git\//,
  /^__pycache__\//,
  /^\.venv\//,
  /^venv\//,
  /^\.pytest_cache\//,
  /^\.mypy_cache\//,
  /^dist\//,
  /^build\//,
  /^\.next\//,
  /^\.nuxt\//,
  /\.pyc$/,
  /\.pyo$/,
  /\.log$/,
  /\.tmp$/,
  /\.temp$/,
  /~$/,
  /^\.DS_Store$/,
  /^Thumbs\.db$/,
]

function shouldIgnore(path: string): boolean {
  const normalized = path.replace(/^\.\//, "").replace(/^\//, "")
  return IGNORED_PATTERNS.some((pattern) => pattern.test(normalized))
}

function normalizePath(path: string): string {
  return path.replace(/^\.\//, "").replace(/^\//, "")
}

// ============================================================================
// Implementation
// ============================================================================

/** Callback called after a file is synced to storage */
export type OnFileSyncCallback = (
  projectId: string,
  change: Omit<FileChange, "timestamp">
) => Promise<void>

export interface CreateChangeTrackerOptions {
  computer: Computer
  storage: Storage
  projectId: string
  /** Optional callback called after each file sync */
  onFileSync?: OnFileSyncCallback
}

export function createChangeTracker(options: CreateChangeTrackerOptions): ChangeTracker {
  const { computer, storage, projectId, onFileSync } = options
  const pending = new Map<string, FileChange>()

  const buildStorageKey = (path: string): string => {
    return `projects/${projectId}/${normalizePath(path)}`
  }

  /**
   * Delete a path from storage, handling both files and directories.
   * For directories, lists all objects with the prefix and deletes each.
   */
  const deleteFromStorage = async (path: string): Promise<void> => {
    const key = buildStorageKey(path)
    // First try to delete as a single file
    await storage.delete(key)
    // Then delete any objects under this path (handles directories)
    const prefix = key.endsWith("/") ? key : `${key}/`
    for await (const entry of storage.list(prefix)) {
      await storage.delete(entry.key)
    }
  }

  const record = (change: Omit<FileChange, "timestamp">): void => {
    const path = normalizePath(change.path)
    if (shouldIgnore(path)) return

    const fullChange: FileChange = {
      ...change,
      path,
      oldPath: change.oldPath ? normalizePath(change.oldPath) : undefined,
      timestamp: new Date(),
    }

    // For moves, also remove the old path from pending
    if (change.type === "move" && change.oldPath) {
      pending.delete(normalizePath(change.oldPath))
    }

    pending.set(path, fullChange)
  }

  const sync = async (change: Omit<FileChange, "timestamp">): Promise<void> => {
    const path = normalizePath(change.path)
    if (shouldIgnore(path)) return

    switch (change.type) {
      case "create":
      case "update": {
        const result = await computer.files.read(path, { encoding: "binary" })
        const data =
          result.type === "binary" ? result.content : new TextEncoder().encode(result.content)
        await storage.put(buildStorageKey(path), data)
        break
      }

      case "delete": {
        await deleteFromStorage(path)
        break
      }

      case "move": {
        if (change.oldPath) {
          const oldPathNormalized = normalizePath(change.oldPath)
          const result = await computer.files.read(path, { encoding: "binary" })
          const data =
            result.type === "binary" ? result.content : new TextEncoder().encode(result.content)
          await storage.put(buildStorageKey(path), data)
          await deleteFromStorage(oldPathNormalized)
        }
        break
      }
    }

    // Call the onFileSync callback if provided
    if (onFileSync) {
      try {
        await onFileSync(projectId, change)
      } catch (err) {
        // Log but don't fail the sync
        console.error(`onFileSync callback failed for ${path}:`, err)
      }
    }
  }

  const snapshot = async (): Promise<FileSnapshot> => {
    const files = new Map<string, { modifiedAt: number; size: number }>()

    const collectFiles = async (dir: string): Promise<void> => {
      try {
        const entries = await computer.files.list(dir)
        for (const entry of entries) {
          const path = normalizePath(entry.path)
          if (shouldIgnore(path)) continue

          if (entry.type === "directory") {
            await collectFiles(entry.path)
          } else if (entry.type === "file") {
            files.set(path, {
              modifiedAt: entry.modifiedAt ?? Date.now(),
              size: entry.size ?? 0,
            })
          }
        }
      } catch {
        // Directory might not exist or be inaccessible
      }
    }

    await collectFiles(".")
    return { files }
  }

  const detectChanges = async (before: FileSnapshot): Promise<FileChange[]> => {
    const after = await snapshot()
    const changes: FileChange[] = []
    const now = new Date()

    // Detect new or modified files
    for (const [path, info] of after.files) {
      const prev = before.files.get(path)
      if (!prev) {
        changes.push({ type: "create", path, source: "terminal", timestamp: now })
      } else if (prev.modifiedAt !== info.modifiedAt || prev.size !== info.size) {
        changes.push({ type: "update", path, source: "terminal", timestamp: now })
      }
    }

    // Detect deleted files
    for (const path of before.files.keys()) {
      if (!after.files.has(path)) {
        changes.push({ type: "delete", path, source: "terminal", timestamp: now })
      }
    }

    return changes
  }

  const getPending = (): FileChange[] => {
    return [...pending.values()]
  }

  const getChanges = (paths: string[]): FileChange[] => {
    return paths
      .map((p) => pending.get(normalizePath(p)))
      .filter((c): c is FileChange => c !== undefined)
  }

  const persist = async (paths?: string[]): Promise<{ persisted: string[] }> => {
    const toPersist = paths
      ? paths.map((p) => normalizePath(p)).filter((p) => pending.has(p))
      : [...pending.keys()]

    const persisted: string[] = []

    for (const path of toPersist) {
      const change = pending.get(path)
      if (!change) continue

      try {
        switch (change.type) {
          case "create":
          case "update": {
            const result = await computer.files.read(path, { encoding: "binary" })
            const data =
              result.type === "binary" ? result.content : new TextEncoder().encode(result.content)
            await storage.put(buildStorageKey(path), data)
            break
          }

          case "delete": {
            await deleteFromStorage(path)
            break
          }

          case "move": {
            if (change.oldPath) {
              // Read from new location, write to new key, delete old key
              const result = await computer.files.read(path, { encoding: "binary" })
              const data =
                result.type === "binary" ? result.content : new TextEncoder().encode(result.content)
              await storage.put(buildStorageKey(path), data)
              await deleteFromStorage(change.oldPath)
            }
            break
          }
        }

        persisted.push(path)
        pending.delete(path)
      } catch (error) {
        // Log but continue with other files
        console.error(`Failed to persist ${path}:`, error)
      }
    }

    return { persisted }
  }

  const clear = (paths?: string[]): void => {
    if (paths) {
      for (const path of paths) {
        pending.delete(normalizePath(path))
      }
    } else {
      pending.clear()
    }
  }

  const hasPending = (): boolean => {
    return pending.size > 0
  }

  return {
    record,
    sync,
    snapshot,
    detectChanges,
    getPending,
    getChanges,
    persist,
    clear,
    hasPending,
  }
}
