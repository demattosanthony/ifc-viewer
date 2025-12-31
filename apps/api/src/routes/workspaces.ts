import { Elysia, t } from "elysia";
import type { AppContext } from "../context";

export function workspacesRoutes(ctx: AppContext) {
  return new Elysia({ prefix: "/api/workspaces" })
    .post(
      "/",
      async ({ body, set }) => {
        // Verify project exists
        const project = await ctx.db.projects.findById(body.projectId);
        if (!project) {
          set.status = 404;
          return { error: "Project not found" };
        }
        return ctx.db.workspaces.create({
          projectId: body.projectId,
          branch: body.branch,
        });
      },
      {
        body: t.Object({
          projectId: t.String(),
          branch: t.Optional(t.String()),
        }),
        detail: {
          summary: "Create a new workspace",
          tags: ["Workspaces"],
        },
      }
    )
    .get(
      "/",
      async () => {
        return ctx.db.workspaces.findAll();
      },
      {
        detail: {
          summary: "List all workspaces",
          tags: ["Workspaces"],
        },
      }
    )
    .get(
      "/active",
      async () => {
        return ctx.db.workspaces.findActive();
      },
      {
        detail: {
          summary: "List active workspaces",
          tags: ["Workspaces"],
        },
      }
    )
    .get(
      "/:id",
      async ({ params, set }) => {
        const workspace = await ctx.db.workspaces.findById(params.id);
        if (!workspace) {
          set.status = 404;
          return { error: "Workspace not found" };
        }
        return workspace;
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: "Get a workspace by ID",
          tags: ["Workspaces"],
        },
      }
    )
    .post(
      "/:id/touch",
      async ({ params, set }) => {
        const existing = await ctx.db.workspaces.findById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Workspace not found" };
        }
        return ctx.db.workspaces.touch(params.id);
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: "Touch a workspace (update last accessed time)",
          tags: ["Workspaces"],
        },
      }
    )
    .post(
      "/:id/stop",
      async ({ params, set }) => {
        const existing = await ctx.db.workspaces.findById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Workspace not found" };
        }
        return ctx.db.workspaces.update(params.id, { status: "stopped" });
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: "Stop a workspace",
          tags: ["Workspaces"],
        },
      }
    )
    .delete(
      "/:id",
      async ({ params, set }) => {
        const existing = await ctx.db.workspaces.findById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Workspace not found" };
        }
        await ctx.db.workspaces.delete(params.id);
        return { success: true };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: "Delete a workspace",
          tags: ["Workspaces"],
        },
      }
    );
}
