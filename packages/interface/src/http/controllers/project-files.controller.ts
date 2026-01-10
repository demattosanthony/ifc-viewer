/**
 * Project Files Controller
 *
 * Framework-agnostic HTTP controller for project file operations.
 * Works directly with storage - no compute environment needed.
 * This is the new architecture: files accessible without spinning up compute.
 */

import type { Context } from "@ifc-viewer/core"
import { createLogger } from "@ifc-viewer/logger"
import { buildStorageKey, deleteStoragePrefix, normalizeStoragePath, isBinaryExtension } from "@ifc-viewer/core"
import type {
  ListFilesResponse,
  ReadFileResponse,
  WriteFileRequest,
  GetPresignedUrlRequest,
  GetPresignedUrlResponse,
  ConfirmUploadRequest,
} from "../../dto/index.ts"
import { type HttpResult, ok, err, notFound, serverError } from "../types.ts"

const log = createLogger("project-files")

/**
 * Detect if content is binary based on file extension or null bytes
 */
function isBinaryContent(data: Uint8Array, path: string): boolean {
  // Check extension first
  if (isBinaryExtension(path)) {
    return true
  }

  // Check for null bytes in first 8KB (indicates binary)
  const sample = data.slice(0, 8192)
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) {
      return true
    }
  }
  return false
}

/**
 * Parse a storage key to extract file info
 */
function parseStorageEntry(
  key: string,
  prefix: string,
  size: number,
  lastModified?: Date
): { name: string; path: string; isFile: boolean } {
  // Remove prefix to get relative path
  const relativePath = key.slice(prefix.length)
  const parts = relativePath.split("/")
  const name = parts[0] ?? relativePath

  // If there are more parts after the first, this entry represents a directory
  const isFile = parts.length === 1 && !relativePath.endsWith("/")

  return {
    name,
    path: relativePath,
    isFile,
  }
}

export class ProjectFilesController {
  constructor(private ctx: Context) {}

  /**
   * Verify project exists
   */
  private async getProject(projectId: string) {
    const project = await this.ctx.db.projects.findById(projectId)
    if (!project) {
      return null
    }
    return project
  }

  /**
   * List files in a project directory.
   * Reads directly from storage - no compute needed.
   */
  async list(projectId: string, path = "."): Promise<HttpResult<ListFilesResponse>> {
    const project = await this.getProject(projectId)
    if (!project) {
      return notFound(`Project ${projectId} not found`)
    }

    // Normalize path: "." and "./" should both become empty string for root
    let normalizedPath = normalizeStoragePath(path)
    if (normalizedPath === ".") {
      normalizedPath = ""
    }
    
    const prefix = normalizedPath
      ? `projects/${projectId}/${normalizedPath}/`
      : `projects/${projectId}/`

    // Collect unique entries at this level (files and immediate subdirectories)
    const entriesMap = new Map<
      string,
      { name: string; path: string; type: "file" | "directory"; size: number; modifiedAt: number }
    >()

    try {
      for await (const entry of this.ctx.storage.list(prefix)) {
        // Get relative path from prefix
        const relativePath = entry.key.slice(prefix.length)
        if (!relativePath) continue

        // Get first path component
        const slashIndex = relativePath.indexOf("/")
        const isDirectory = slashIndex !== -1
        const name = isDirectory ? relativePath.slice(0, slashIndex) : relativePath

        // Skip if we already have this entry
        if (entriesMap.has(name)) {
          // If it's a directory, update size (aggregate)
          if (isDirectory) {
            const existing = entriesMap.get(name)!
            existing.size += entry.size
          }
          continue
        }

        const entryPath = normalizedPath ? `${normalizedPath}/${name}` : name

        entriesMap.set(name, {
          name,
          path: entryPath,
          type: isDirectory ? "directory" : "file",
          size: entry.size,
          modifiedAt: entry.lastModified?.getTime() ?? Date.now(),
        })
      }

      const files = Array.from(entriesMap.values()).sort((a, b) => {
        // Directories first, then alphabetically
        if (a.type !== b.type) {
          return a.type === "directory" ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      return ok({ files, path: normalizedPath || "." })
    } catch (error) {
      log.error("Failed to list files", { projectId, path, error })
      return serverError("Failed to list files")
    }
  }

  /**
   * Read file content directly from storage.
   */
  async read(projectId: string, path: string): Promise<HttpResult<ReadFileResponse>> {
    if (!path) {
      return err("Path is required", 400)
    }

    const project = await this.getProject(projectId)
    if (!project) {
      return notFound(`Project ${projectId} not found`)
    }

    const storageKey = buildStorageKey(projectId, path)

    try {
      const obj = await this.ctx.storage.get(storageKey)
      if (!obj) {
        return notFound("File not found")
      }

      const isBinary = isBinaryContent(obj.data, path)

      return ok({
        path,
        type: isBinary ? "binary" : "text",
        content: isBinary
          ? Buffer.from(obj.data).toString("base64")
          : new TextDecoder().decode(obj.data),
      })
    } catch (error) {
      log.error("Failed to read file", { projectId, path, error })
      return notFound("File not found")
    }
  }

  /**
   * Write file content directly to storage.
   */
  async write(
    projectId: string,
    input: WriteFileRequest
  ): Promise<HttpResult<{ success: true; path: string }>> {
    const project = await this.getProject(projectId)
    if (!project) {
      return notFound(`Project ${projectId} not found`)
    }

    try {
      const content = input.isBinary
        ? new Uint8Array(Buffer.from(input.content, "base64"))
        : new TextEncoder().encode(input.content)

      const storageKey = buildStorageKey(projectId, input.path)
      await this.ctx.storage.put(storageKey, content)

      log.debug("File written", { projectId, path: input.path, size: content.byteLength })

      return ok({ success: true, path: input.path })
    } catch (error) {
      log.error("Failed to write file", { projectId, path: input.path, error })
      return serverError("Failed to write file")
    }
  }

  /**
   * Delete a file or directory from storage.
   */
  async delete(
    projectId: string,
    path: string
  ): Promise<HttpResult<{ success: true; path: string }>> {
    if (!path) {
      return err("Path is required", 400)
    }

    const project = await this.getProject(projectId)
    if (!project) {
      return notFound(`Project ${projectId} not found`)
    }

    log.debug("Deleting file", { projectId, path })

    try {
      const storageKey = buildStorageKey(projectId, path)

      // Delete the exact key (if file) and all keys with this prefix (if directory)
      await this.ctx.storage.delete(storageKey)
      await deleteStoragePrefix(this.ctx.storage, `${storageKey}/`)

      log.debug("Deleted from storage", { storageKey })

      return ok({ success: true, path })
    } catch (error) {
      log.error("Failed to delete file", { projectId, path, error })
      return serverError("Failed to delete file")
    }
  }

  /**
   * Create a directory marker in storage.
   * Note: Object storage doesn't truly have directories, but we can create a marker.
   */
  async mkdir(
    projectId: string,
    path: string
  ): Promise<HttpResult<{ success: true; path: string }>> {
    const project = await this.getProject(projectId)
    if (!project) {
      return notFound(`Project ${projectId} not found`)
    }

    // In object storage, directories are implicit. We don't need to create them.
    // But for consistency, we can create a .gitkeep or empty marker if needed.
    // For now, just return success.
    return ok({ success: true, path })
  }

  /**
   * Upload file directly to storage.
   */
  async upload(
    projectId: string,
    path: string,
    data: Uint8Array,
    contentType?: string
  ): Promise<HttpResult<{ success: true; path: string }>> {
    const project = await this.getProject(projectId)
    if (!project) {
      return notFound(`Project ${projectId} not found`)
    }

    try {
      const storageKey = buildStorageKey(projectId, path)
      await this.ctx.storage.put(storageKey, data, { contentType })

      log.info("File uploaded", { projectId, path, size: data.byteLength })

      return ok({ success: true, path })
    } catch (error) {
      log.error("Upload failed", { projectId, path, error })
      return serverError("Failed to upload file")
    }
  }

  /**
   * Get presigned URL for direct S3 upload (optimization for S3 storage).
   * Returns error if storage doesn't support presigned URLs.
   */
  async getPresignedUrl(
    projectId: string,
    input: GetPresignedUrlRequest
  ): Promise<HttpResult<GetPresignedUrlResponse>> {
    // Only S3 storage supports presigned URLs
    if (this.ctx.storage.type !== "s3") {
      return err("Presigned URLs not supported with current storage", 501)
    }

    const project = await this.getProject(projectId)
    if (!project) {
      return notFound(`Project ${projectId} not found`)
    }

    const storageKey = buildStorageKey(projectId, input.path)
    const credentials = await this.ctx.storage.getUploadUrl(storageKey, {
      contentType: input.contentType,
      expiresIn: 300, // 5 minutes
    })

    if (!credentials) {
      return serverError("Failed to generate presigned URL")
    }

    return ok({
      url: credentials.url,
      method: credentials.method,
      headers: credentials.headers,
    })
  }

  /**
   * Confirm S3 upload - just validates the file exists in storage.
   * No compute sync needed in the new architecture.
   */
  async confirmUpload(
    projectId: string,
    input: ConfirmUploadRequest
  ): Promise<HttpResult<{ success: true; path: string }>> {
    const project = await this.getProject(projectId)
    if (!project) {
      return notFound(`Project ${projectId} not found`)
    }

    try {
      const storageKey = buildStorageKey(projectId, input.path)
      const exists = await this.ctx.storage.exists(storageKey)

      if (!exists) {
        return notFound("File not found in storage")
      }

      log.info("Upload confirmed", { projectId, path: input.path })

      return ok({ success: true, path: input.path })
    } catch (error) {
      log.error("Failed to confirm upload", { projectId, path: input.path, error })
      return serverError("Failed to confirm upload")
    }
  }

  /**
   * Get a download URL for a file.
   * Returns a presigned URL for S3, or null for other storage types.
   */
  async getDownloadUrl(
    projectId: string,
    path: string
  ): Promise<HttpResult<{ url: string } | { content: string; type: "text" | "binary" }>> {
    const project = await this.getProject(projectId)
    if (!project) {
      return notFound(`Project ${projectId} not found`)
    }

    const storageKey = buildStorageKey(projectId, path)

    // Try to get a presigned URL first (works for S3)
    const url = await this.ctx.storage.getUrl(storageKey, { expiresIn: 3600 })
    if (url) {
      return ok({ url })
    }

    // Fall back to reading the content directly
    const obj = await this.ctx.storage.get(storageKey)
    if (!obj) {
      return notFound("File not found")
    }

    const isBinary = isBinaryContent(obj.data, path)
    return ok({
      content: isBinary
        ? Buffer.from(obj.data).toString("base64")
        : new TextDecoder().decode(obj.data),
      type: isBinary ? "binary" : "text",
    })
  }
}
