/**
 * Files Controller
 *
 * Framework-agnostic HTTP controller for file operations.
 * All file writes are persisted to both compute and project storage.
 */

import type { Context, FileEntry as CoreFileEntry, Computer, Workspace } from "@ifc-viewer/core"
import { createLogger } from "@ifc-viewer/logger"
import { buildStorageKey, deleteStoragePrefix } from "@ifc-viewer/core"
import type {
  ListFilesResponse,
  ReadFileResponse,
  WriteFileRequest,
  CreateDirectoryRequest,
  GetPresignedUrlRequest,
  GetPresignedUrlResponse,
  ConfirmUploadRequest,
} from "../../dto"
import { type HttpResult, type HttpError, ok, err, notFound, serverError } from "../types"

const log = createLogger("files")

type WorkspaceComputeResult =
  | { ok: true; workspace: Workspace; computer: Computer }
  | { ok: false; error: HttpError }

export class FilesController {
  constructor(private ctx: Context) {}

  /**
   * Get compute for workspace, ensuring it exists
   */
  private async getWorkspaceCompute(workspaceId: string): Promise<WorkspaceComputeResult> {
    const workspace = await this.ctx.db.workspaces.findById(workspaceId)
    if (!workspace) {
      return { ok: false, error: notFound(`Workspace ${workspaceId} not found`) }
    }

    const computer = await this.ctx.getOrCreateCompute(workspace.id, workspace.workingDirectory)
    return { ok: true, workspace, computer }
  }

  /**
   * List files in a directory
   */
  async list(workspaceId: string, path = "."): Promise<HttpResult<ListFilesResponse>> {
    const result = await this.getWorkspaceCompute(workspaceId)
    if (!result.ok) return result.error

    const { computer } = result
    const files = await computer.files.list(path)

    return ok({
      files: files.map((f: CoreFileEntry) => ({
        name: f.name,
        path: f.path,
        type: f.type,
        size: f.size,
        modifiedAt: f.modifiedAt,
      })),
      path,
    })
  }

  /**
   * Read file content
   */
  async read(workspaceId: string, path: string): Promise<HttpResult<ReadFileResponse>> {
    if (!path) {
      return err("Path is required", 400)
    }

    const result = await this.getWorkspaceCompute(workspaceId)
    if (!result.ok) return result.error

    const { computer } = result

    try {
      const fileResult = await computer.files.read(path)
      return ok({
        path,
        type: fileResult.type,
        content:
          fileResult.type === "text"
            ? fileResult.content
            : Buffer.from(fileResult.content).toString("base64"),
      })
    } catch {
      return notFound("File not found")
    }
  }

  /**
   * Write file content (persists to both compute and project storage)
   */
  async write(
    workspaceId: string,
    input: WriteFileRequest
  ): Promise<HttpResult<{ success: true; path: string }>> {
    const result = await this.getWorkspaceCompute(workspaceId)
    if (!result.ok) return result.error

    const { workspace, computer } = result

    try {
      const content = input.isBinary
        ? new Uint8Array(Buffer.from(input.content, "base64"))
        : input.content

      // Write to compute environment
      await computer.files.write(input.path, content)

      // Persist to project storage
      const storageKey = buildStorageKey(workspace.projectId, input.path)
      const storageContent =
        typeof content === "string" ? new TextEncoder().encode(content) : content
      await this.ctx.storage.put(storageKey, storageContent)

      return ok({ success: true, path: input.path })
    } catch {
      return serverError("Failed to write file")
    }
  }

  /**
   * Delete a file or directory (removes from both compute and project storage)
   */
  async delete(
    workspaceId: string,
    path: string
  ): Promise<HttpResult<{ success: true; path: string }>> {
    if (!path) {
      return err("Path is required", 400)
    }

    const result = await this.getWorkspaceCompute(workspaceId)
    if (!result.ok) return result.error

    const { workspace, computer } = result

    log.debug("Deleting file", { workspaceId, projectId: workspace.projectId, path })

    try {
      // Delete from compute environment
      await computer.files.delete(path, { recursive: true })
      log.debug("Deleted from compute", { path })

      // Delete from project storage (handles both files and directories)
      const storageKey = buildStorageKey(workspace.projectId, path)

      // Delete the exact key (if file) and all keys with this prefix (if directory)
      await this.ctx.storage.delete(storageKey)
      await deleteStoragePrefix(this.ctx.storage, `${storageKey}/`)

      log.debug("Deleted from storage", { storageKey })

      return ok({ success: true, path })
    } catch (error) {
      log.error("Failed to delete file", { path, error })
      return serverError("Failed to delete file")
    }
  }

  /**
   * Create a directory
   */
  async mkdir(
    workspaceId: string,
    input: CreateDirectoryRequest
  ): Promise<HttpResult<{ success: true; path: string }>> {
    const result = await this.getWorkspaceCompute(workspaceId)
    if (!result.ok) return result.error

    const { computer } = result

    try {
      await computer.files.mkdir(input.path, { recursive: true })
      return ok({ success: true, path: input.path })
    } catch {
      return serverError("Failed to create directory")
    }
  }

  /**
   * Upload file - writes to both storage and compute in one step.
   * This is the primary upload method that works with any storage backend.
   */
  async upload(
    workspaceId: string,
    path: string,
    data: Uint8Array,
    contentType?: string
  ): Promise<HttpResult<{ success: true; path: string }>> {
    const result = await this.getWorkspaceCompute(workspaceId)
    if (!result.ok) return result.error

    const { workspace, computer } = result

    try {
      const storageKey = buildStorageKey(workspace.projectId, path)

      // Write to both storage and compute in parallel
      await Promise.all([
        this.ctx.storage.put(storageKey, data, { contentType }),
        computer.files.write(path, data),
      ])

      log.info("File uploaded", { workspaceId, path, size: data.byteLength })

      return ok({ success: true, path })
    } catch (error) {
      log.error("Upload failed", { workspaceId, path, error })
      return serverError("Failed to upload file")
    }
  }

  /**
   * Get presigned URL for direct S3 upload (optimization for S3 storage).
   * Returns null/error if storage doesn't support presigned URLs.
   */
  async getPresignedUrl(
    workspaceId: string,
    input: GetPresignedUrlRequest
  ): Promise<HttpResult<GetPresignedUrlResponse>> {
    // Only S3 storage supports presigned URLs
    if (this.ctx.storage.type !== "s3") {
      return err("Presigned URLs not supported with current storage", 501)
    }

    const workspace = await this.ctx.db.workspaces.findById(workspaceId)
    if (!workspace) {
      return notFound(`Workspace ${workspaceId} not found`)
    }

    const storageKey = buildStorageKey(workspace.projectId, input.path)
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
   * Confirm S3 upload - fetches from S3 and syncs to compute environment.
   * Only needed after uploading via presigned URL.
   */
  async confirmUpload(
    workspaceId: string,
    input: ConfirmUploadRequest
  ): Promise<HttpResult<{ success: true; path: string }>> {
    const result = await this.getWorkspaceCompute(workspaceId)
    if (!result.ok) return result.error

    const { workspace, computer } = result

    try {
      const storageKey = buildStorageKey(workspace.projectId, input.path)
      const obj = await this.ctx.storage.get(storageKey)

      if (!obj) {
        return notFound("File not found in storage")
      }

      await computer.files.write(input.path, obj.data)

      log.info("Upload confirmed", { workspaceId, path: input.path, size: obj.data.byteLength })

      return ok({ success: true, path: input.path })
    } catch (error) {
      log.error("Failed to confirm upload", { workspaceId, path: input.path, error })
      return serverError("Failed to sync file to workspace")
    }
  }
}
