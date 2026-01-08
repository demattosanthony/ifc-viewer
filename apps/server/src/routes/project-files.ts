/**
 * Project Files Routes
 *
 * File operations at /api/projects/:id/files
 */

import { Elysia, t } from "elysia";
import type { Context } from "@ifc-viewer/core";
import {
  ProjectFilesController,
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
} from "@ifc-viewer/interface";
import { z } from "zod";

export function projectFilesRoutes(ctx: Context) {
  const controller = new ProjectFilesController(ctx);

  return new Elysia({ prefix: "/api/projects/:id/files" })
    .get(
      "/",
      async ({ params, query }) => {
        const result = await controller.list(params.id, query.path);
        if (!result.success) {
          return { files: [], path: query.path ?? "." };
        }
        return result.data;
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
          summary: "List files in a project directory",
          tags: ["Project Files"],
          operationId: "listProjectFiles",
        },
      }
    )
    .get(
      "/content",
      async ({ params, query, set }) => {
        const result = await controller.read(params.id, query.path);
        if (!result.success) {
          set.status = result.status;
          return { error: result.error };
        }
        return result.data;
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
          summary: "Read file content from project",
          tags: ["Project Files"],
          operationId: "readProjectFile",
        },
      }
    )
    .post(
      "/content",
      async ({ params, body, set }) => {
        const result = await controller.write(params.id, body);
        if (!result.success) {
          set.status = result.status;
          return { error: result.error };
        }
        return result.data;
      },
      {
        params: z.object({
          id: z.string(),
        }),
        body: WriteFileRequest,
        response: {
          200: SuccessWithPathResponse,
          404: ErrorResponse,
          500: ErrorResponse,
        },
        detail: {
          summary: "Write file content to project",
          tags: ["Project Files"],
          operationId: "writeProjectFile",
        },
      }
    )
    .delete(
      "/",
      async ({ params, query, set }) => {
        const result = await controller.delete(params.id, query.path);
        if (!result.success) {
          set.status = result.status;
          return { error: result.error };
        }
        return result.data;
      },
      {
        params: z.object({
          id: z.string(),
        }),
        query: DeleteFileQuery,
        response: {
          200: SuccessWithPathResponse,
          400: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse,
        },
        detail: {
          summary: "Delete a file or directory from project",
          tags: ["Project Files"],
          operationId: "deleteProjectFile",
        },
      }
    )
    .post(
      "/directory",
      async ({ params, body, set }) => {
        const result = await controller.mkdir(params.id, body.path);
        if (!result.success) {
          set.status = result.status;
          return { error: result.error };
        }
        return result.data;
      },
      {
        params: z.object({
          id: z.string(),
        }),
        body: CreateDirectoryRequest,
        response: {
          200: SuccessWithPathResponse,
          404: ErrorResponse,
          500: ErrorResponse,
        },
        detail: {
          summary: "Create a directory in project",
          tags: ["Project Files"],
          operationId: "createProjectDirectory",
        },
      }
    )
    .post(
      "/upload",
      async ({ params, body, set }) => {
        const { file, path } = body;

        // Convert File to Uint8Array
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        const result = await controller.upload(
          params.id,
          path,
          data,
          file.type
        );
        if (!result.success) {
          set.status = result.status;
          return { error: result.error };
        }
        return result.data;
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
          summary: "Upload file to project",
          description:
            "Upload a file using multipart/form-data directly to project storage.",
          tags: ["Project Files"],
          operationId: "uploadProjectFile",
        },
      }
    )
    .post(
      "/presigned-url",
      async ({ params, body, set }) => {
        const result = await controller.getPresignedUrl(params.id, body);
        if (!result.success) {
          set.status = result.status;
          return { error: result.error };
        }
        return result.data;
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
          summary: "Get presigned upload URL for project",
          description:
            "Get a presigned URL for direct S3 upload. Returns 501 if storage doesn't support presigned URLs.",
          tags: ["Project Files"],
          operationId: "getProjectPresignedUrl",
        },
      }
    )
    .post(
      "/confirm-upload",
      async ({ params, body, set }) => {
        const result = await controller.confirmUpload(params.id, body);
        if (!result.success) {
          set.status = result.status;
          return { error: result.error };
        }
        return result.data;
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
          summary: "Confirm S3 upload to project",
          description:
            "After uploading via presigned URL, call this to confirm the upload.",
          tags: ["Project Files"],
          operationId: "confirmProjectUpload",
        },
      }
    );
}
