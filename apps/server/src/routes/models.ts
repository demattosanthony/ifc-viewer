import { Elysia } from "elysia"
import type { Context } from "@ifc-viewer/core"
import {
  ModelController,
  UpdateModelRequest,
  ModelResponse,
  ErrorResponse,
  SuccessResponse,
} from "@ifc-viewer/interface"
import { z } from "zod"

export function modelsRoutes(ctx: Context) {
  const controller = new ModelController(ctx)

  return new Elysia({ prefix: "/api/projects/:id/models" })
    .get(
      "/",
      async ({ params, set }) => {
        const result = await controller.list(params.id)
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
        response: {
          200: z.array(ModelResponse),
          404: ErrorResponse,
        },
        detail: {
          summary: "List models for a project",
          tags: ["Models"],
          operationId: "listModels",
        },
      }
    )
    .get(
      "/:modelId",
      async ({ params, set }) => {
        const result = await controller.getById(params.id, params.modelId)
        if (!result.success) {
          set.status = result.status
          return { error: result.error }
        }
        return result.data
      },
      {
        params: z.object({
          id: z.string(),
          modelId: z.string(),
        }),
        response: {
          200: ModelResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Get model metadata",
          tags: ["Models"],
          operationId: "getModel",
        },
      }
    )
    .get(
      "/:modelId/file",
      async ({ params, set }) => {
        const result = await controller.getModelFile(params.id, params.modelId)
        if (!result.success) {
          set.status = result.status
          return { error: result.error }
        }

        // Return binary data with proper headers
        set.headers["content-type"] = result.data.contentType
        set.headers["content-disposition"] = `attachment; filename="model.ifc"`
        return new Response(result.data.data.buffer as ArrayBuffer)
      },
      {
        params: z.object({
          id: z.string(),
          modelId: z.string(),
        }),
        detail: {
          summary: "Download model IFC file",
          tags: ["Models"],
          operationId: "getModelFile",
        },
      }
    )
    .post(
      "/",
      async ({ params, body, set }) => {
        // Get the uploaded file
        const file = body.file
        if (!file) {
          set.status = 400
          return { error: "No file provided" }
        }

        // Read file data
        const data = new Uint8Array(await file.arrayBuffer())
        const fileName = file.name || "model.ifc"

        const result = await controller.upload(params.id, fileName, data, {
          name: body.name || fileName.replace(/\.ifc$/i, ""),
          discipline: body.discipline,
        })

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
        body: z.object({
          file: z.instanceof(File),
          name: z.string().optional(),
          discipline: z.enum(["architecture", "structure", "mep", "site", "other"]).optional(),
        }),
        response: {
          200: ModelResponse,
          400: ErrorResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Upload a new model",
          tags: ["Models"],
          operationId: "uploadModel",
        },
      }
    )
    .patch(
      "/:modelId",
      async ({ params, body, set }) => {
        const result = await controller.update(params.id, params.modelId, body)
        if (!result.success) {
          set.status = result.status
          return { error: result.error }
        }
        return result.data
      },
      {
        params: z.object({
          id: z.string(),
          modelId: z.string(),
        }),
        body: UpdateModelRequest,
        response: {
          200: ModelResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Update model metadata",
          tags: ["Models"],
          operationId: "updateModel",
        },
      }
    )
    .delete(
      "/:modelId",
      async ({ params, set }) => {
        const result = await controller.delete(params.id, params.modelId)
        if (!result.success) {
          set.status = result.status
          return { error: result.error }
        }
        return result.data
      },
      {
        params: z.object({
          id: z.string(),
          modelId: z.string(),
        }),
        response: {
          200: SuccessResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Delete a model",
          tags: ["Models"],
          operationId: "deleteModel",
        },
      }
    )
}
