import { Elysia, t } from "elysia"
import { useCases, isDomainError, type Context } from "@ifc-viewer/core"
import { ErrorResponse, SuccessResponse } from "../../schemas"
import { WorkspaceResponse, WorkspaceListResponse } from "./workspaces.schemas"

export function workspacesRoutes(ctx: Context) {
  return new Elysia({ prefix: "/api/workspaces" })
    .post(
      "/",
      async ({ body, set }) => {
        try {
          return await useCases.createWorkspace(ctx, body)
        } catch (error) {
          if (isDomainError(error)) {
            set.status = error.statusCode
            return { error: error.message }
          }
          throw error
        }
      },
      {
        body: t.Object({
          projectId: t.String(),
        }),
        response: {
          200: WorkspaceResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Create a new workspace",
          tags: ["Workspaces"],
        },
      }
    )
    .get(
      "/",
      async () => {
        return useCases.listWorkspaces(ctx)
      },
      {
        response: {
          200: WorkspaceListResponse,
        },
        detail: {
          summary: "List all workspaces",
          tags: ["Workspaces"],
        },
      }
    )
    .get(
      "/active",
      async () => {
        return useCases.listActiveWorkspaces(ctx)
      },
      {
        response: {
          200: WorkspaceListResponse,
        },
        detail: {
          summary: "List active workspaces",
          tags: ["Workspaces"],
        },
      }
    )
    .get(
      "/:id",
      async ({ params, set }) => {
        try {
          return await useCases.getWorkspace(ctx, params.id)
        } catch (error) {
          if (isDomainError(error)) {
            set.status = error.statusCode
            return { error: error.message }
          }
          throw error
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: WorkspaceResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Get a workspace by ID",
          tags: ["Workspaces"],
        },
      }
    )
    .post(
      "/:id/touch",
      async ({ params, set }) => {
        try {
          return await useCases.touchWorkspace(ctx, params.id)
        } catch (error) {
          if (isDomainError(error)) {
            set.status = error.statusCode
            return { error: error.message }
          }
          throw error
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: WorkspaceResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Touch a workspace (update last accessed time)",
          tags: ["Workspaces"],
        },
      }
    )
    .post(
      "/:id/stop",
      async ({ params, set }) => {
        try {
          return await useCases.stopWorkspace(ctx, params.id)
        } catch (error) {
          if (isDomainError(error)) {
            set.status = error.statusCode
            return { error: error.message }
          }
          throw error
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: WorkspaceResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Stop a workspace",
          tags: ["Workspaces"],
        },
      }
    )
    .delete(
      "/:id",
      async ({ params, set }) => {
        try {
          await useCases.deleteWorkspace(ctx, params.id)
          return { success: true }
        } catch (error) {
          if (isDomainError(error)) {
            set.status = error.statusCode
            return { error: error.message }
          }
          throw error
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: SuccessResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Delete a workspace",
          tags: ["Workspaces"],
        },
      }
    )
}
