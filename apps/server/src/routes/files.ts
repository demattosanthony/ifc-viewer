import { Elysia } from "elysia"
import type { Context } from "@ifc-viewer/core"
import {
  FilesController,
  WriteFileRequest,
  CreateDirectoryRequest,
  ListFilesQuery,
  ReadFileQuery,
  DeleteFileQuery,
  ListFilesResponse,
  ReadFileResponse,
  ErrorResponse,
  SuccessWithPathResponse,
} from "@ifc-viewer/interface"
import { z } from "zod"

export function filesRoutes(ctx: Context) {
  const controller = new FilesController(ctx)

  return new Elysia({ prefix: "/api/workspaces/:id/files" })
    .get(
      "/",
      async ({ params, query }) => {
        const result = await controller.list(params.id, query.path)
        if (!result.success) {
          return { files: [], path: query.path ?? "." }
        }
        return result.data
      },
      {
        params: z.object({
          id: z.string(),
        }),
        query: ListFilesQuery,
        response: {
          200: ListFilesResponse,
        },
        detail: {
          summary: "List files in a directory",
          tags: ["Files"],
          operationId: "listFiles",
        },
      }
    )
    .get(
      "/content",
      async ({ params, query, set }) => {
        const result = await controller.read(params.id, query.path)
        if (!result.success) {
          set.status = result.status
          return { error: result.error }
        }
        return result.data
      },
      {
        params: z.object({
          id: z.string(),
        }),
        query: ReadFileQuery,
        response: {
          200: ReadFileResponse,
          400: ErrorResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Read file content",
          tags: ["Files"],
          operationId: "readFile",
        },
      }
    )
    .post(
      "/content",
      async ({ params, body, set }) => {
        const result = await controller.write(params.id, body)
        if (!result.success) {
          set.status = result.status
          return { error: result.error }
        }
        return result.data
      },
      {
        params: z.object({
          id: z.string(),
        }),
        body: WriteFileRequest,
        response: {
          200: SuccessWithPathResponse,
          500: ErrorResponse,
        },
        detail: {
          summary: "Write file content",
          tags: ["Files"],
          operationId: "writeFile",
        },
      }
    )
    .delete(
      "/",
      async ({ params, query, set }) => {
        const result = await controller.delete(params.id, query.path)
        if (!result.success) {
          set.status = result.status
          return { error: result.error }
        }
        return result.data
      },
      {
        params: z.object({
          id: z.string(),
        }),
        query: DeleteFileQuery,
        response: {
          200: SuccessWithPathResponse,
          400: ErrorResponse,
          500: ErrorResponse,
        },
        detail: {
          summary: "Delete a file or directory",
          tags: ["Files"],
          operationId: "deleteFile",
        },
      }
    )
    .post(
      "/directory",
      async ({ params, body, set }) => {
        const result = await controller.mkdir(params.id, body)
        if (!result.success) {
          set.status = result.status
          return { error: result.error }
        }
        return result.data
      },
      {
        params: z.object({
          id: z.string(),
        }),
        body: CreateDirectoryRequest,
        response: {
          200: SuccessWithPathResponse,
          500: ErrorResponse,
        },
        detail: {
          summary: "Create a directory",
          tags: ["Files"],
          operationId: "createDirectory",
        },
      }
    )
}
