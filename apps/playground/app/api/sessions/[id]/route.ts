import { sessionManager } from "@/shared/utils/session-manager";
import { route } from "@ademattos/bunbox";
import { z } from "zod";

export const disposeSession = route
  .delete()
  .params(z.object({ id: z.string() }))
  .handle(async ({ params }) => {
    const sessionId = params.id;
    if (!sessionId) {
      throw new Error("Session ID is required");
    }
    sessionManager.disposeSession(sessionId);
    return {
      message: "Session disposed",
    };
  });

export const getSession = route.get().handle(async (ctx) => {
  const sessionId = ctx.params.id;
  if (!sessionId) {
    return ctx.json({ error: "Session ID is required" }, 400);
  }
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return ctx.json({ error: "Session not found" }, 404);
  }
  return ctx.json(session);
});

// POST handler for navigator.sendBeacon (which only supports POST)
export const disposeSessionBeacon = route
  .post()
  .params(z.object({ id: z.string() }))
  .handle(async ({ params }) => {
    const sessionId = params.id;
    if (!sessionId) {
      throw new Error("Session ID is required");
    }
    sessionManager.disposeSession(sessionId);
    return {
      message: "Session disposed",
    };
  });
