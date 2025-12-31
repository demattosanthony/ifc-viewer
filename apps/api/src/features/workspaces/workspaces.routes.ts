import { Elysia, t } from "elysia";
import type { AppContext } from "../../context";
import { ErrorResponse, SuccessResponse } from "../../schemas";
import { WorkspaceResponse, WorkspaceListResponse } from "./workspaces.schemas";

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

        // Create workspace
        const workspace = await ctx.db.workspaces.create({
          projectId: body.projectId,
        });

        // Load project files into compute
        await ctx.loadProjectIntoCompute(body.projectId);

        return workspace;
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
        return ctx.db.workspaces.findAll();
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
        return ctx.db.workspaces.findActive();
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
        response: {
          200: SuccessResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Delete a workspace",
          tags: ["Workspaces"],
        },
      }
    );
}
