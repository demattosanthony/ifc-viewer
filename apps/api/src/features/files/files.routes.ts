import { Elysia, t } from "elysia";
import type { Context, Compute } from "@ifc-viewer/core";
import { ErrorResponse, SuccessWithPathResponse } from "../../schemas";

const FileEntrySchema = t.Object({
  name: t.String(),
  path: t.String(),
  type: t.Union([t.Literal("file"), t.Literal("directory"), t.Literal("symlink")]),
  size: t.Number(),
  modifiedAt: t.Number(),
});

export function filesRoutes(ctx: Context) {
  return new Elysia({ prefix: "/api/workspaces/:id/files" })
    .get(
      "/",
      async ({ params, query }) => {
        const computer = ctx.getCompute(params.id);
        const path = query.path ?? ".";
        const files = await computer.files.list(path);

        return {
          files: files.map((f: Compute.FileEntry) => ({
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
        response: {
          200: t.Object({
            files: t.Array(FileEntrySchema),
            path: t.String(),
          }),
        },
        detail: {
          summary: "List files in a directory",
          tags: ["Files"],
        },
      }
    )
    .get(
      "/content",
      async ({ params, query, set }) => {
        const computer = ctx.getCompute(params.id);

        if (!query.path) {
          set.status = 400;
          return { error: "Path is required" };
        }

        try {
          const result = await computer.files.read(query.path);
          return {
            path: query.path,
            type: result.type,
            content:
              result.type === "text"
                ? result.content
                : Buffer.from(result.content).toString("base64"),
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
        response: {
          200: t.Object({
            path: t.String(),
            type: t.Union([t.Literal("text"), t.Literal("binary")]),
            content: t.String(),
          }),
          400: ErrorResponse,
          404: ErrorResponse,
        },
        detail: {
          summary: "Read file content",
          tags: ["Files"],
        },
      }
    )
    .post(
      "/content",
      async ({ params, body, set }) => {
        const computer = ctx.getCompute(params.id);

        try {
          const content = body.isBinary
            ? new Uint8Array(Buffer.from(body.content, "base64"))
            : body.content;

          await computer.files.write(body.path, content);

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
        response: {
          200: SuccessWithPathResponse,
          500: ErrorResponse,
        },
        detail: {
          summary: "Write file content",
          tags: ["Files"],
        },
      }
    )
    .delete(
      "/",
      async ({ params, query, set }) => {
        const computer = ctx.getCompute(params.id);

        if (!query.path) {
          set.status = 400;
          return { error: "Path is required" };
        }

        try {
          await computer.files.delete(query.path, { recursive: true });
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
        response: {
          200: SuccessWithPathResponse,
          400: ErrorResponse,
          500: ErrorResponse,
        },
        detail: {
          summary: "Delete a file or directory",
          tags: ["Files"],
        },
      }
    )
    .post(
      "/directory",
      async ({ params, body, set }) => {
        const computer = ctx.getCompute(params.id);

        try {
          await computer.files.mkdir(body.path, { recursive: true });
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
        response: {
          200: SuccessWithPathResponse,
          500: ErrorResponse,
        },
        detail: {
          summary: "Create a directory",
          tags: ["Files"],
        },
      }
    );
}
