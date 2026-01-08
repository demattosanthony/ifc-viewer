import { Elysia } from "elysia"
import type { Context } from "@ifc-viewer/core"
import {
  ProjectController,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectResponse,
  ErrorResponse,
  SuccessResponse,
} from "@ifc-viewer/interface"
import { z } from "zod"

export function projectsRoutes(ctx: Context) {
  const controller = new ProjectController(ctx)

  return new Elysia({ prefix: "/api/projects" })
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
        body: CreateProjectRequest,
        response: {
          200: ProjectResponse,
          400: ErrorResponse,
        },
        detail: {
          summary: "Create a new project",
          tags: ["Projects"],
          operationId: "createProject",
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
          200: z.array(ProjectResponse),
        },
        detail: {
          summary: "List all projects",
          tags: ["Projects"],
          operationId: "listProjects",
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
          200: ProjectResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Get a project by ID",
          tags: ["Projects"],
          operationId: "getProject",
        },
      }
    )
    .patch(
      "/:id",
      async ({ params, body, set }) => {
        const result = await controller.update(params.id, body)
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
        body: UpdateProjectRequest,
        response: {
          200: ProjectResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Update a project",
          tags: ["Projects"],
          operationId: "updateProject",
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
          summary: "Delete a project",
          tags: ["Projects"],
          operationId: "deleteProject",
        },
      }
    )
}
