import { Elysia, t } from "elysia";
import { isDomainError } from "@ifc-viewer/core";
import type { AppContext } from "../context";

export function projectsRoutes(ctx: AppContext) {
  return new Elysia({ prefix: "/api/projects" })
    .post(
      "/",
      async ({ body }) => {
        // Check if project with same name already exists (idempotent create)
        const existing = await ctx.client.projects.getByName(body.name);
        if (existing) {
          return existing;
        }
        const project = await ctx.client.projects.create({
          name: body.name,
          description: body.description,
          defaultBranch: body.defaultBranch,
        });
        return project;
      },
      {
        body: t.Object({
          name: t.String(),
          description: t.Optional(t.String()),
          defaultBranch: t.Optional(t.String()),
        }),
        detail: {
          summary: "Create a new project (or return existing if name matches)",
          tags: ["Projects"],
        },
      }
    )
    .get(
      "/",
      async () => {
        const projects = await ctx.client.projects.list();
        return projects;
      },
      {
        detail: {
          summary: "List all projects",
          tags: ["Projects"],
        },
      }
    )
    .get(
      "/:id",
      async ({ params, set }) => {
        const project = await ctx.client.projects.get(params.id);
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
          const project = await ctx.client.projects.update(params.id, {
            name: body.name,
            description: body.description,
            defaultBranch: body.defaultBranch,
          });
          return project;
        } catch (error) {
          if (isDomainError(error)) {
            set.status = error.statusCode;
            return error.toJSON();
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
          defaultBranch: t.Optional(t.String()),
        }),
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
          await ctx.client.projects.delete(params.id);
          return { success: true };
        } catch (error) {
          if (isDomainError(error)) {
            set.status = error.statusCode;
            return error.toJSON();
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: "Delete a project",
          tags: ["Projects"],
        },
      }
    )
    .get(
      "/:id/workspaces",
      async ({ params }) => {
        const workspaces = await ctx.client.workspaces.listByProject(params.id);
        return workspaces;
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: "List workspaces for a project",
          tags: ["Projects"],
        },
      }
    );
}
