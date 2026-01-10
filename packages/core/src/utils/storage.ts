/**
 * Storage Utilities
 *
 * Utilities for working with project storage paths and keys.
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
 * Extensions that represent binary (non-text) files.
 */
const binaryExtensions = new Set([
  "ifc", "png", "jpg", "jpeg", "gif", "webp", "pdf", "zip", "tar", "gz",
  "bin", "exe", "dll", "so", "dylib", "wasm", "glb", "gltf", "obj",
])

/**
 * Check if a filename has a binary extension.
 */
export function isBinaryExtension(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return binaryExtensions.has(ext)
}

/**
 * Build a storage key for a project file.
 * Format: `projects/{projectId}/{path}`
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
