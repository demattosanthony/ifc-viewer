import { Elysia, t } from "elysia";
import type { AppContext } from "../context";

/**
 * Session management routes
 *
 * In local dev mode, all sessions share the same computer/workspace.
 * The session ID is still used for tracking but the underlying
 * computer instance is shared.
 */
export function sessionsRoutes(ctx: AppContext) {
  return new Elysia({ prefix: "/api/sessions" })
    .post(
      "/",
      async () => {
        // Create session in database
        const session = await ctx.db.sessions.create({});

        return {
          id: session.id,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        };
      },
      {
        detail: {
          summary: "Create a new session",
          tags: ["Sessions"],
        },
        response: t.Object({
          id: t.String(),
          createdAt: t.String(),
          expiresAt: t.String(),
        }),
      }
    )
    .get(
      "/",
      async () => {
        const sessions = await ctx.db.sessions.findAll();
        return sessions.map((s) => ({
          id: s.id,
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
        }));
      },
      {
        detail: {
          summary: "List all sessions",
          tags: ["Sessions"],
        },
        response: t.Array(
          t.Object({
            id: t.String(),
            createdAt: t.String(),
            expiresAt: t.String(),
          })
        ),
      }
    )
    .get(
      "/:id",
      async ({ params, set }) => {
        const session = await ctx.db.sessions.findById(params.id);
        if (!session) {
          set.status = 404;
          return { error: "Session not found" };
        }

        return {
          id: session.id,
          workingDirectory: ctx.computer.workingDirectory,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: "Get a session by ID",
          tags: ["Sessions"],
        },
      }
    )
    .delete(
      "/:id",
      async ({ params, set }) => {
        const session = await ctx.db.sessions.findById(params.id);
        if (!session) {
          set.status = 404;
          return { error: "Session not found" };
        }

        // Delete from database
        // In shared mode, we don't dispose the computer
        await ctx.db.sessions.delete(params.id);

        return { success: true };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: "Delete a session",
          tags: ["Sessions"],
        },
      }
    )
    .post(
      "/:id/touch",
      async ({ params, set }) => {
        const session = await ctx.db.sessions.findById(params.id);
        if (!session) {
          set.status = 404;
          return { error: "Session not found" };
        }

        // Extend session expiry by 5 minutes
        await ctx.db.sessions.touch(params.id, 5 * 60 * 1000);

        return { success: true };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: "Touch a session to extend its expiry",
          tags: ["Sessions"],
        },
      }
    );
}
