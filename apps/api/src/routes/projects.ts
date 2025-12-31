import { Elysia, t } from "elysia";
import type { AppContext } from "../context";

export function projectsRoutes(ctx: AppContext) {
  return new Elysia({ prefix: "/api/projects" })
    .post(
      "/",
      async ({ body }) => {
        // Check if project with same name already exists (idempotent create)
        const existing = await ctx.db.projects.findByName(body.name);
        if (existing) {
          return existing;
        }
        return ctx.db.projects.create({
          name: body.name,
          description: body.description,
          defaultBranch: body.defaultBranch,
        });
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
        return ctx.db.projects.findAll();
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
          name: body.name,
          description: body.description,
          defaultBranch: body.defaultBranch,
        });
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
        const existing = await ctx.db.projects.findById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Project not found" };
        }
        await ctx.db.projects.delete(params.id);
        return { success: true };
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
        return ctx.db.workspaces.findByProjectId(params.id);
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
