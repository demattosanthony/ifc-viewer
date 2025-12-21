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
