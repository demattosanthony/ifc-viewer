import { Elysia, t } from "elysia";
import { isDomainError } from "@ifc-viewer/core";
import type { AppContext } from "../context";

export function sessionsRoutes(ctx: AppContext) {
  return new Elysia({ prefix: "/api/sessions" })
    .post(
      "/",
      async () => {
        const session = await ctx.client.sessions.create();
        return session;
      },
      {
        detail: {
          summary: "Create a new session",
          tags: ["Sessions"],
        },
        response: t.Object({
          id: t.String(),
          workingDirectory: t.String(),
          createdAt: t.String(),
          expiresAt: t.String(),
          status: t.String(),
          metadata: t.Optional(t.Record(t.String(), t.Unknown())),
        }),
      }
    )
    .get(
      "/",
      async () => {
        const sessions = await ctx.client.sessions.list();
        return sessions;
      },
      {
        detail: {
          summary: "List all sessions",
          tags: ["Sessions"],
        },
        response: t.Array(
          t.Object({
            id: t.String(),
            workingDirectory: t.String(),
            createdAt: t.String(),
            expiresAt: t.String(),
            status: t.String(),
            metadata: t.Optional(t.Record(t.String(), t.Unknown())),
          })
        ),
      }
    )
    .get(
      "/:id",
      async ({ params, set }) => {
        const session = await ctx.client.sessions.get(params.id);
        if (!session) {
          set.status = 404;
          return { error: "Session not found" };
        }
        return session;
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
        try {
          await ctx.client.sessions.delete(params.id);
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
          summary: "Delete a session",
          tags: ["Sessions"],
        },
      }
    )
    .post(
      "/:id/touch",
      async ({ params, set }) => {
        try {
          const session = await ctx.client.sessions.touch(params.id);
          return session;
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
          summary: "Touch a session to extend its expiry",
          tags: ["Sessions"],
        },
      }
    );
}
