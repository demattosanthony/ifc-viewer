import { Elysia, t } from "elysia";
import { isDomainError } from "@ifc-viewer/core";
import type { AppContext } from "../context";

export function workspacesRoutes(ctx: AppContext) {
  return new Elysia({ prefix: "/api/workspaces" })
    .post(
      "/",
      async ({ body, set }) => {
        // Verify project exists
        const project = await ctx.client.projects.get(body.projectId);
        if (!project) {
          set.status = 404;
          return { error: "Project not found" };
        }

        const workspace = await ctx.client.workspaces.create({
          projectId: body.projectId,
          branch: body.branch,
        });
        return workspace;
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
        const workspaces = await ctx.client.workspaces.list();
        return workspaces;
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
        const workspaces = await ctx.client.workspaces.listActive();
        return workspaces;
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
        const workspace = await ctx.client.workspaces.get(params.id);
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
        try {
          const workspace = await ctx.client.workspaces.touch(params.id);
          return workspace;
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
          summary: "Touch a workspace (update last accessed time)",
          tags: ["Workspaces"],
        },
      }
    )
    .post(
      "/:id/stop",
      async ({ params, set }) => {
        try {
          const workspace = await ctx.client.workspaces.update(params.id, {
            status: "stopped",
          });
          return workspace;
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
          summary: "Stop a workspace",
          tags: ["Workspaces"],
        },
      }
    )
    .delete(
      "/:id",
      async ({ params, set }) => {
        try {
          await ctx.client.workspaces.delete(params.id);
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
          summary: "Delete a workspace",
          tags: ["Workspaces"],
        },
      }
    );
}
