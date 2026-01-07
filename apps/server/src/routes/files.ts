import { Elysia, t } from "elysia"
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
  GetPresignedUrlRequest,
  GetPresignedUrlResponse,
  ConfirmUploadRequest,
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
    .post(
      "/upload",
      async ({ params, body, set }) => {
        const { file, path } = body

        // Convert File to Uint8Array
        const arrayBuffer = await file.arrayBuffer()
        const data = new Uint8Array(arrayBuffer)

        const result = await controller.upload(params.id, path, data, file.type)
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
        body: t.Object({
          file: t.File(),
          path: t.String(),
        }),
        type: "multipart",
        response: {
          200: SuccessWithPathResponse,
          400: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse,
        },
        detail: {
          summary: "Upload file",
          description: "Upload a file using multipart/form-data. Writes to both storage and compute environment.",
          tags: ["Files"],
          operationId: "uploadFile",
        },
      }
    )
    .post(
      "/presigned-url",
      async ({ params, body, set }) => {
        const result = await controller.getPresignedUrl(params.id, body)
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
        body: GetPresignedUrlRequest,
        response: {
          200: GetPresignedUrlResponse,
          404: ErrorResponse,
          500: ErrorResponse,
          501: ErrorResponse,
        },
        detail: {
          summary: "Get presigned upload URL",
          description: "Get a presigned URL for direct S3 upload. Returns 501 if storage doesn't support presigned URLs.",
          tags: ["Files"],
          operationId: "getPresignedUrl",
        },
      }
    )
    .post(
      "/confirm-upload",
      async ({ params, body, set }) => {
        const result = await controller.confirmUpload(params.id, body)
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
        body: ConfirmUploadRequest,
        response: {
          200: SuccessWithPathResponse,
          404: ErrorResponse,
          500: ErrorResponse,
        },
        detail: {
          summary: "Confirm S3 upload",
          description: "After uploading via presigned URL, call this to sync the file to the workspace.",
          tags: ["Files"],
          operationId: "confirmUpload",
        },
      }
    )
}
