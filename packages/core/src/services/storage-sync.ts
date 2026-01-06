/**
 * Storage Sync Utilities
 *
 * Shared utilities for syncing files between compute and storage.
 * Used by both the AI agent service and HTTP file controllers.
 */

import type { Storage } from "../ports"

/**
 * Normalize a file path for use as a storage key.
 * Removes leading "./" and "/" to prevent malformed keys.
 */
export function normalizeStoragePath(path: string): string {
  return path.replace(/^\.\//, "").replace(/^\//, "")
}

/**
 * Build a storage key for a project file.
 */
export function buildStorageKey(projectId: string, path: string): string {
  return `projects/${projectId}/${normalizeStoragePath(path)}`
}

/**
 * Delete all storage entries under a prefix (for recursive directory delete).
 */
export async function deleteStoragePrefix(
  storage: Storage,
  prefix: string
): Promise<void> {
  const keysToDelete: string[] = []
  for await (const entry of storage.list(prefix)) {
    keysToDelete.push(entry.key)
  }
  await Promise.all(keysToDelete.map((key) => storage.delete(key)))
}

/**
 * Options for creating storage sync callbacks.
 */
export interface StorageSyncOptions {
  storage: Storage
  projectId: string
}

/**
 * Callback types for storage sync operations.
 */
export interface StorageSyncCallbacks {
  onFileWrite: (path: string, content: Uint8Array | string) => Promise<void>
  onFileDelete: (path: string, options?: { recursive?: boolean }) => Promise<void>
  onFileMove: (source: string, destination: string) => Promise<void>
}

/**
 * Create storage sync callbacks for a project.
 * These callbacks handle write-through persistence to storage.
 */
export function createStorageSyncCallbacks(
  options: StorageSyncOptions
): StorageSyncCallbacks {
  const { storage, projectId } = options

  const onFileWrite = async (
    path: string,
    content: Uint8Array | string
  ): Promise<void> => {
    const key = buildStorageKey(projectId, path)
    const data =
      typeof content === "string" ? new TextEncoder().encode(content) : content
    await storage.put(key, data)
  }

  const onFileDelete = async (
    path: string,
    opts?: { recursive?: boolean }
  ): Promise<void> => {
    const key = buildStorageKey(projectId, path)
    await storage.delete(key)

    if (opts?.recursive) {
      await deleteStoragePrefix(storage, `${key}/`)
    }
  }

  const onFileMove = async (
    source: string,
    destination: string
  ): Promise<void> => {
    const sourceKey = buildStorageKey(projectId, source)
    const destKey = buildStorageKey(projectId, destination)

    // Try to move as a single file first
    const obj = await storage.get(sourceKey)
    if (obj) {
      await storage.put(destKey, obj.data)
      await storage.delete(sourceKey)
      return
    }

    // If not a file, handle as directory - move all entries under the prefix
    const sourcePrefix = `${sourceKey}/`
    const moves: Array<{ oldKey: string; newKey: string; data: Uint8Array }> =
      []

    for await (const entry of storage.list(sourcePrefix)) {
      const relativePath = entry.key.slice(sourcePrefix.length)
      const content = await storage.get(entry.key)
      if (content) {
        moves.push({
          oldKey: entry.key,
          newKey: `${destKey}/${relativePath}`,
          data: content.data,
        })
      }
    }

    // Write to new locations and delete old ones
    await Promise.all(moves.map((m) => storage.put(m.newKey, m.data)))
    await Promise.all(moves.map((m) => storage.delete(m.oldKey)))
  }

  return { onFileWrite, onFileDelete, onFileMove }
}
