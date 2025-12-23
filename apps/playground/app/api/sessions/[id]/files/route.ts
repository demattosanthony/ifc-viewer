import { sessionManager } from "@/lib/session-manager";
import { route } from "@ademattos/bunbox";
import { z } from "zod";

export const listFiles = route
  .get()
  .params(z.object({ id: z.string() }))
  .query(z.object({ path: z.string().default(".") }))
  .handle(async (ctx) => {
    const session = sessionManager.getSession(ctx.params.id);
    if (!session) {
      return ctx.json({ error: "Session not found" }, 404);
    }
    const files = await session.computer.files.list(ctx.query.path);
    return { files, path: ctx.query.path };
  });

export const deleteFile = route
  .delete()
  .params(z.object({ id: z.string() }))
  .query(z.object({ path: z.string() }))
  .handle(async (ctx) => {
    const session = sessionManager.getSession(ctx.params.id);
    if (!session) {
      return ctx.json({ error: "Session not found" }, 404);
    }

    try {
      await session.computer.files.delete(ctx.query.path, { recursive: true });
      return { success: true, path: ctx.query.path };
    } catch (err) {
      return ctx.json({ error: "Failed to delete file" }, 500);
    }
  });

export const createDirectory = route
  .post()
  .params(z.object({ id: z.string() }))
  .body(z.object({ path: z.string() }))
  .handle(async (ctx) => {
    const session = sessionManager.getSession(ctx.params.id);
    if (!session) {
      return ctx.json({ error: "Session not found" }, 404);
    }

    try {
      await session.computer.files.mkdir(ctx.body.path, { recursive: true });
      return { success: true, path: ctx.body.path };
    } catch (err) {
      return ctx.json({ error: "Failed to create directory" }, 500);
    }
  });
