import { Elysia, t } from "elysia";
import type { AppContext } from "../context";

/**
 * File operations routes
 */
export function filesRoutes(ctx: AppContext) {
  return new Elysia({ prefix: "/api/sessions/:id/files" })
    .get(
      "/",
      async ({ params, query, set }) => {
        const sandbox = ctx.getSandbox(params.id);
        if (!sandbox) {
          set.status = 404;
          return { error: "Session not found" };
        }

        const path = query.path ?? ".";
        const files = await sandbox.computer.files.list(path);

        return {
          files: files.map((f) => ({
            name: f.name,
            path: f.path,
            type: f.type,
            size: f.size,
            modifiedAt: f.modifiedAt,
          })),
          path,
        };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        query: t.Object({
          path: t.Optional(t.String()),
        }),
        detail: {
          summary: "List files in a directory",
          tags: ["Files"],
        },
      }
    )
    .get(
      "/content",
      async ({ params, query, set }) => {
        const sandbox = ctx.getSandbox(params.id);
        if (!sandbox) {
          set.status = 404;
          return { error: "Session not found" };
        }

        if (!query.path) {
          set.status = 400;
          return { error: "Path is required" };
        }

        try {
          const content = await sandbox.computer.files.read(query.path);
          return {
            path: query.path,
            type: content.type,
            content:
              content.type === "text"
                ? content.content
                : Buffer.from(content.content as unknown as Uint8Array).toString("base64"),
          };
        } catch {
          set.status = 404;
          return { error: "File not found" };
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        query: t.Object({
          path: t.String(),
        }),
        detail: {
          summary: "Read file content",
          tags: ["Files"],
        },
      }
    )
    .post(
      "/content",
      async ({ params, body, set }) => {
        const sandbox = ctx.getSandbox(params.id);
        if (!sandbox) {
          set.status = 404;
          return { error: "Session not found" };
        }

        try {
          const content = body.isBinary
            ? new Uint8Array(Buffer.from(body.content, "base64"))
            : body.content;

          await sandbox.computer.files.write(body.path, content);

          return { success: true, path: body.path };
        } catch {
          set.status = 500;
          return { error: "Failed to write file" };
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          path: t.String(),
          content: t.String(),
          isBinary: t.Optional(t.Boolean()),
        }),
        detail: {
          summary: "Write file content",
          tags: ["Files"],
        },
      }
    )
    .delete(
      "/",
      async ({ params, query, set }) => {
        const sandbox = ctx.getSandbox(params.id);
        if (!sandbox) {
          set.status = 404;
          return { error: "Session not found" };
        }

        if (!query.path) {
          set.status = 400;
          return { error: "Path is required" };
        }

        try {
          await sandbox.computer.files.delete(query.path, { recursive: true });
          return { success: true, path: query.path };
        } catch {
          set.status = 500;
          return { error: "Failed to delete file" };
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        query: t.Object({
          path: t.String(),
        }),
        detail: {
          summary: "Delete a file or directory",
          tags: ["Files"],
        },
      }
    )
    .post(
      "/directory",
      async ({ params, body, set }) => {
        const sandbox = ctx.getSandbox(params.id);
        if (!sandbox) {
          set.status = 404;
          return { error: "Session not found" };
        }

        try {
          await sandbox.computer.files.mkdir(body.path, { recursive: true });
          return { success: true, path: body.path };
        } catch {
          set.status = 500;
          return { error: "Failed to create directory" };
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          path: t.String(),
        }),
        detail: {
          summary: "Create a directory",
          tags: ["Files"],
        },
      }
    );
}
