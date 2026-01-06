/**
 * Files Controller
 *
 * Framework-agnostic HTTP controller for file operations.
 * All file writes are persisted to both compute and project storage.
 */

import type { Context, FileEntry as CoreFileEntry, Computer, Workspace } from "@ifc-viewer/core"
import {
  buildStorageKey,
  deleteStoragePrefix,
} from "@ifc-viewer/core"
import type {
  ListFilesResponse,
  ReadFileResponse,
  WriteFileRequest,
  CreateDirectoryRequest,
} from "../../dto"
import { type HttpResult, type HttpError, ok, err, notFound, serverError } from "../types"

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

    console.log(`[FilesController] Deleting file: workspace=${workspaceId}, projectId=${workspace.projectId}, path=${path}`)

    try {
      // Delete from compute environment
      console.log(`[FilesController] Deleting from compute: ${path}`)
      await computer.files.delete(path, { recursive: true })
      console.log(`[FilesController] Deleted from compute successfully`)

      // Delete from project storage (handles both files and directories)
      const storageKey = buildStorageKey(workspace.projectId, path)
      console.log(`[FilesController] Deleting from storage: ${storageKey}`)

      // Check if file exists before deleting
      const existsBefore = await this.ctx.storage.exists(storageKey)
      console.log(`[FilesController] Storage key exists before delete: ${existsBefore}`)

      // Delete the exact key (if file) and all keys with this prefix (if directory)
      await this.ctx.storage.delete(storageKey)
      await deleteStoragePrefix(this.ctx.storage, `${storageKey}/`)

      // Verify deletion
      const existsAfter = await this.ctx.storage.exists(storageKey)
      console.log(`[FilesController] Storage key exists after delete: ${existsAfter}`)

      if (existsAfter) {
        console.error(`[FilesController] WARNING: File still exists in storage after delete!`)
      }

      console.log(`[FilesController] Deleted from storage successfully`)

      return ok({ success: true, path })
    } catch (error) {
      console.error(`[FilesController] Failed to delete file:`, error)
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
}
