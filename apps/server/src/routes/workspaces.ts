import { Elysia } from "elysia"
import type { Context } from "@ifc-viewer/core"
import {
  WorkspaceController,
  CreateWorkspaceRequest,
  WorkspaceResponse,
  ErrorResponse,
  SuccessResponse,
} from "@ifc-viewer/interface"
import { z } from "zod"

export function workspacesRoutes(ctx: Context) {
  const controller = new WorkspaceController(ctx)

  return new Elysia({ prefix: "/api/workspaces" })
    .post(
      "/",
      async ({ body, set }) => {
        const result = await controller.create(body)
        if (!result.success) {
          set.status = result.status
          return { error: result.error }
        }
        return result.data
      },
      {
        body: CreateWorkspaceRequest,
        response: {
          200: WorkspaceResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Create a new workspace",
          tags: ["Workspaces"],
          operationId: "createWorkspace",
        },
      }
    )
    .get(
      "/",
      async () => {
        const result = await controller.list()
        if (!result.success) return []
        return result.data
      },
      {
        response: {
          200: z.array(WorkspaceResponse),
        },
        detail: {
          summary: "List all workspaces",
          tags: ["Workspaces"],
          operationId: "listWorkspaces",
        },
      }
    )
    .get(
      "/active",
      async () => {
        const result = await controller.listActive()
        if (!result.success) return []
        return result.data
      },
      {
        response: {
          200: z.array(WorkspaceResponse),
        },
        detail: {
          summary: "List active workspaces",
          tags: ["Workspaces"],
          operationId: "listActiveWorkspaces",
        },
      }
    )
    .get(
      "/:id",
      async ({ params, set }) => {
        const result = await controller.getById(params.id)
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
          200: WorkspaceResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Get a workspace by ID",
          tags: ["Workspaces"],
          operationId: "getWorkspace",
        },
      }
    )
    .post(
      "/:id/touch",
      async ({ params, set }) => {
        const result = await controller.touch(params.id)
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
          200: WorkspaceResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Touch a workspace (update last accessed time)",
          tags: ["Workspaces"],
          operationId: "touchWorkspace",
        },
      }
    )
    .post(
      "/:id/stop",
      async ({ params, set }) => {
        const result = await controller.stop(params.id)
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
          200: WorkspaceResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Stop a workspace",
          tags: ["Workspaces"],
          operationId: "stopWorkspace",
        },
      }
    )
    .delete(
      "/:id",
      async ({ params, set }) => {
        const result = await controller.delete(params.id)
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
          200: SuccessResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Delete a workspace",
          tags: ["Workspaces"],
          operationId: "deleteWorkspace",
        },
      }
    )
}
