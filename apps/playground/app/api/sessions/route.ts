import { sessionManager } from "@/shared/utils/session-manager";
import { route } from "@ademattos/bunbox";

export const createSession = route.post().handle(async (ctx) => {
  const session = await sessionManager.createSession();
  return {
    id: session.id,
  };
});

export const getSessions = route.get().handle(async (ctx) => {
  const sessions = sessionManager.getSessions();
  return ctx.json(sessions);
});
