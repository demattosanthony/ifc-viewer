/**
 * Files Controller
 *
 * Framework-agnostic HTTP controller for file operations.
 */

import type { Context, FileEntry as CoreFileEntry } from "@ifc-viewer/core"
import type {
  ListFilesResponse,
  ReadFileResponse,
  WriteFileRequest,
  CreateDirectoryRequest,
} from "../../dto"
import { type HttpResult, ok, err, notFound, serverError } from "../types"

export class FilesController {
  constructor(private ctx: Context) {}

  /**
   * List files in a directory
   */
  async list(workspaceId: string, path = "."): Promise<HttpResult<ListFilesResponse>> {
    const computer = this.ctx.getCompute(workspaceId)
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

    const computer = this.ctx.getCompute(workspaceId)

    try {
      const result = await computer.files.read(path)
      return ok({
        path,
        type: result.type,
        content:
          result.type === "text"
            ? result.content
            : Buffer.from(result.content).toString("base64"),
      })
    } catch {
      return notFound("File not found")
    }
  }

  /**
   * Write file content
   */
  async write(
    workspaceId: string,
    input: WriteFileRequest
  ): Promise<HttpResult<{ success: true; path: string }>> {
    const computer = this.ctx.getCompute(workspaceId)

    try {
      const content = input.isBinary
        ? new Uint8Array(Buffer.from(input.content, "base64"))
        : input.content

      await computer.files.write(input.path, content)
      return ok({ success: true, path: input.path })
    } catch {
      return serverError("Failed to write file")
    }
  }

  /**
   * Delete a file or directory
   */
  async delete(
    workspaceId: string,
    path: string
  ): Promise<HttpResult<{ success: true; path: string }>> {
    if (!path) {
      return err("Path is required", 400)
    }

    const computer = this.ctx.getCompute(workspaceId)

    try {
      await computer.files.delete(path, { recursive: true })
      return ok({ success: true, path })
    } catch {
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
    const computer = this.ctx.getCompute(workspaceId)

    try {
      await computer.files.mkdir(input.path, { recursive: true })
      return ok({ success: true, path: input.path })
    } catch {
      return serverError("Failed to create directory")
    }
  }
}
