import { Elysia, t } from "elysia"
import { Project, Workspace, isDomainError, type Context } from "@ifc-viewer/core"
import { ErrorResponse, SuccessResponse } from "../../schemas"
import { z2e } from "../../schemas/zod-to-elysia"

export function projectsRoutes(ctx: Context) {
  return new Elysia({ prefix: "/api/projects" })
    .post(
      "/",
      async ({ body, set }) => {
        try {
          return await Project.create(ctx, body)
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
          200: z2e(Project.Entity),
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
        return Project.list(ctx)
      },
      {
        response: {
          200: t.Array(z2e(Project.Entity)),
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
        try {
          return await Project.get(ctx, params.id)
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
          200: z2e(Project.Entity),
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
        try {
          return await Project.update(ctx, params.id, body)
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
        body: t.Object({
          description: t.Optional(t.String()),
        }),
        response: {
          200: z2e(Project.Entity),
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
        try {
          await Project.remove(ctx, params.id)
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
          summary: "Delete a project",
          tags: ["Projects"],
        },
      }
    )
    .get(
      "/:id/workspaces",
      async ({ params }) => {
        return Workspace.listByProject(ctx, params.id)
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: t.Array(z2e(Workspace.Entity)),
        },
        detail: {
          summary: "List workspaces for a project",
          tags: ["Projects"],
        },
      }
    )
}
