import { Elysia, t } from "elysia";
import { isValidProjectSlug } from "@ifc-viewer/core";
import type { AppContext } from "../../context";
import { ErrorResponse, SuccessResponse } from "../../schemas";
import { ProjectResponse, ProjectListResponse } from "./projects.schemas";
import { WorkspaceListResponse } from "../workspaces/workspaces.schemas";

export function projectsRoutes(ctx: AppContext) {
  return new Elysia({ prefix: "/api/projects" })
    .post(
      "/",
      async ({ body, set }) => {
        // Validate slug format
        if (!isValidProjectSlug(body.id)) {
          set.status = 400;
          return {
            error:
              "Invalid project ID. Must be lowercase alphanumeric with hyphens, 1-100 characters.",
          };
        }

        // Check if project already exists (idempotent create)
        const existing = await ctx.db.projects.findById(body.id);
        if (existing) {
          return existing;
        }

        // Create project in DB
        const project = await ctx.db.projects.create({
          id: body.id,
          description: body.description,
        });

        // Create project directory in storage
        await ctx.storage.put(`projects/${body.id}/.gitkeep`, "", {
          contentType: "text/plain",
        });

        return project;
      },
      {
        body: t.Object({
          id: t.String({ minLength: 1, maxLength: 100 }),
          description: t.Optional(t.String()),
        }),
        response: {
          200: ProjectResponse,
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
        return ctx.db.projects.findAll();
      },
      {
        response: {
          200: ProjectListResponse,
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
        const project = await ctx.db.projects.findById(params.id);
        if (!project) {
          set.status = 404;
          return { error: "Project not found" };
        }
        return project;
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: ProjectResponse,
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
        const existing = await ctx.db.projects.findById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Project not found" };
        }
        return ctx.db.projects.update(params.id, {
          description: body.description,
        });
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          description: t.Optional(t.String()),
        }),
        response: {
          200: ProjectResponse,
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
        const existing = await ctx.db.projects.findById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Project not found" };
        }

        // Delete project files from storage
        const projectPrefix = `projects/${params.id}/`;
        for await (const entry of ctx.storage.list(projectPrefix)) {
          await ctx.storage.delete(entry.key);
        }

        // Delete from database
        await ctx.db.projects.delete(params.id);
        return { success: true };
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
        return ctx.db.workspaces.findByProjectId(params.id);
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        response: {
          200: WorkspaceListResponse,
        },
        detail: {
          summary: "List workspaces for a project",
          tags: ["Projects"],
        },
      }
    );
}
