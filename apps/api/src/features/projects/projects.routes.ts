import { Elysia, t } from "elysia"
import {
  ProjectSchema,
  WorkspaceSchema,
  isDomainError,
  NotFoundError,
  createProjectWithStorage,
  type Context
} from "@ifc-viewer/core"
import { ErrorResponse, SuccessResponse } from "../../schemas"
import { z2e } from "../../schemas/zod-to-elysia"

export function projectsRoutes(ctx: Context) {
  return new Elysia({ prefix: "/api/projects" })
    .post(
      "/",
      async ({ body, set }) => {
        try {
          // Use service for create (has storage initialization logic)
          return await createProjectWithStorage(ctx, body)
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
          id: t.String({ minLength: 1, maxLength: 100 }),
          description: t.Optional(t.String()),
        }),
        response: {
          200: z2e(ProjectSchema),
          400: ErrorResponse,
        },
        detail: {
          summary: "Create a new project",
          tags: ["Projects"],
        },
      }
    )
    .get(
      "/",
      async () => {
        // Direct repository call
        return ctx.db.projects.findAll()
      },
      {
        response: {
          200: t.Array(z2e(ProjectSchema)),
        },
        detail: {
          summary: "List all projects",
          tags: ["Projects"],
        },
      }
    )
    .get(
      "/:id",
      async ({ params, set }) => {
        // Direct repository call
        const project = await ctx.db.projects.findById(params.id)
        if (!project) {
          set.status = 404
          return { error: `Project ${params.id} not found` }
        }
        return project
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: z2e(ProjectSchema),
          404: ErrorResponse,
        },
        detail: {
          summary: "Get a project by ID",
          tags: ["Projects"],
        },
      }
    )
    .patch(
      "/:id",
      async ({ params, body, set }) => {
        // Direct repository call
        const existing = await ctx.db.projects.findById(params.id)
        if (!existing) {
          set.status = 404
          return { error: `Project ${params.id} not found` }
        }
        return ctx.db.projects.update(params.id, body)
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          description: t.Optional(t.String()),
        }),
        response: {
          200: z2e(ProjectSchema),
          404: ErrorResponse,
        },
        detail: {
          summary: "Update a project",
          tags: ["Projects"],
        },
      }
    )
    .delete(
      "/:id",
      async ({ params, set }) => {
        // Direct repository call
        const existing = await ctx.db.projects.findById(params.id)
        if (!existing) {
          set.status = 404
          return { error: `Project ${params.id} not found` }
        }
        await ctx.db.projects.delete(params.id)
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
          summary: "Delete a project",
          tags: ["Projects"],
        },
      }
    )
    .get(
      "/:id/workspaces",
      async ({ params }) => {
        // Direct repository call
        return ctx.db.workspaces.findByProjectId(params.id)
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: t.Array(z2e(WorkspaceSchema)),
        },
        detail: {
          summary: "List workspaces for a project",
          tags: ["Projects"],
        },
      }
    )
}
