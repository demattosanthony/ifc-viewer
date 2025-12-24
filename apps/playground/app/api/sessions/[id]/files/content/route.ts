import { sessionManager } from "@/lib/session-manager";
import { route } from "@ademattos/bunbox";
import { z } from "zod";

// Binary file extensions that should be read as binary
const BINARY_EXTENSIONS = new Set([
  "ifc",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "svg",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "otf",
  "zip",
  "tar",
  "gz",
  "rar",
  "7z",
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "dat",
]);

function isBinaryFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return BINARY_EXTENSIONS.has(ext);
}

export const readFile = route
  .get()
  .params(z.object({ id: z.string() }))
  .query(z.object({ path: z.string() }))
  .handle(async (ctx) => {
    const session = sessionManager.getSession(ctx.params.id);
    if (!session) {
      return ctx.json({ error: "Session not found" }, 404);
    }

    try {
      const isBinary = isBinaryFile(ctx.query.path);
      const result = await session.computer.files.read(ctx.query.path, {
        encoding: isBinary ? "binary" : undefined,
      });

      if (result.type === "binary") {
        return ctx.json({
          type: "binary",
          content: Buffer.from(result.content).toString("base64"),
          path: ctx.query.path,
        });
      }

      return {
        type: "text",
        content: result.content,
        path: ctx.query.path,
      };
    } catch (err) {
      return ctx.json({ error: "File not found" }, 404);
    }
  });

export const writeFile = route
  .post()
  .params(z.object({ id: z.string() }))
  .body(
    z.object({
      path: z.string(),
      content: z.string(),
      encoding: z.enum(["text", "base64"]).default("text"),
    })
  )
  .handle(async (ctx) => {
    const session = sessionManager.getSession(ctx.params.id);
    if (!session) {
      return ctx.json({ error: "Session not found" }, 404);
    }

    try {
      const { path, content, encoding } = ctx.body;
      const fileContent =
        encoding === "base64"
          ? new Uint8Array(Buffer.from(content, "base64"))
          : content;

      await session.computer.files.write(path, fileContent);
      return { success: true, path };
    } catch (err) {
      return ctx.json({ error: "Failed to write file" }, 500);
    }
  });
