import { Elysia, t } from "elysia"
import {
  WorkspaceSchema,
  isDomainError,
  createWorkspaceWithFiles,
  type Context
} from "@ifc-viewer/core"
import { ErrorResponse, SuccessResponse } from "../../schemas"
import { z2e } from "../../schemas/zod-to-elysia"

export function workspacesRoutes(ctx: Context) {
  return new Elysia({ prefix: "/api/workspaces" })
    .post(
      "/",
      async ({ body, set }) => {
        try {
          // Use service for create (loads files into compute)
          return await createWorkspaceWithFiles(ctx, body)
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
          200: z2e(WorkspaceSchema),
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
        // Direct repository call
        return ctx.db.workspaces.findAll()
      },
      {
        response: {
          200: t.Array(z2e(WorkspaceSchema)),
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
        // Direct repository call
        return ctx.db.workspaces.findActive()
      },
      {
        response: {
          200: t.Array(z2e(WorkspaceSchema)),
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
        // Direct repository call
        const workspace = await ctx.db.workspaces.findById(params.id)
        if (!workspace) {
          set.status = 404
          return { error: `Workspace ${params.id} not found` }
        }
        return workspace
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: z2e(WorkspaceSchema),
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
        // Direct repository call
        const existing = await ctx.db.workspaces.findById(params.id)
        if (!existing) {
          set.status = 404
          return { error: `Workspace ${params.id} not found` }
        }
        return ctx.db.workspaces.touch(params.id)
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: z2e(WorkspaceSchema),
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
        // Direct repository call
        const existing = await ctx.db.workspaces.findById(params.id)
        if (!existing) {
          set.status = 404
          return { error: `Workspace ${params.id} not found` }
        }
        return ctx.db.workspaces.update(params.id, { status: "stopped" })
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: z2e(WorkspaceSchema),
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
        // Direct repository call
        const existing = await ctx.db.workspaces.findById(params.id)
        if (!existing) {
          set.status = 404
          return { error: `Workspace ${params.id} not found` }
        }
        await ctx.db.workspaces.delete(params.id)
        return { success: true }
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
