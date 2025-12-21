import { sessionManager } from "@/lib/session-manager";
import type { ServerWebSocket, WebSocketContext } from "@ademattos/bunbox";

interface CustomData {
  sessionId: string;
  terminalId?: string;
}

interface BunboxWsData {
  data: CustomData;
}

interface InputMessage {
  type: "input";
  data: string;
}

interface ResizeMessage {
  type: "resize";
  cols: number;
  rows: number;
}

type ClientMessage = InputMessage | ResizeMessage;

function getCustomData(ws: ServerWebSocket): CustomData {
  return (ws.data as BunboxWsData).data;
}

export function upgrade(req: Request): boolean | { data?: unknown } {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return false;
  }

  return { data: { sessionId } };
}

export async function onOpen(ws: ServerWebSocket, _ctx: WebSocketContext) {
  try {
    const customData = getCustomData(ws);
    const { sessionId } = customData;

    if (!sessionId) {
      ws.close(1008, "Session ID is required");
      return;
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      ws.close(1008, "Session not found");
      return;
    }

    const terminal = await sessionManager.createTerminal(sessionId);
    customData.terminalId = terminal.id;

    terminal.onExit((code: number) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "exit", code }));
        ws.close(1000, "Terminal exited");
      }
    });

    terminal.onData((data: string) => {
      if (ws.readyState === 1) {
        const cleanData = data.replace(/\x1b\[\?1034h/g, "");
        ws.send(JSON.stringify({ type: "output", data: cleanData }));
      }
    });

    ws.send(JSON.stringify({ type: "ready", terminalId: terminal.id }));
  } catch (error) {
    console.error("[WS] Error in onOpen:", error);
    ws.close(1011, "Internal error");
  }
}

export async function onMessage(
  ws: ServerWebSocket,
  message: string,
  _ctx: WebSocketContext
) {
  const { sessionId, terminalId } = getCustomData(ws);

  if (!sessionId || !terminalId) {
    ws.close(1008, "Session or terminal ID is required");
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    ws.close(1008, "Session not found");
    return;
  }

  const terminal = session.terminals.get(terminalId);
  if (!terminal) {
    ws.close(1008, "Terminal not found");
    return;
  }

  try {
    const parsed: ClientMessage = JSON.parse(message);

    if (parsed.type === "input" && parsed.data) {
      await terminal.write(parsed.data);
    } else if (parsed.type === "resize" && parsed.cols && parsed.rows) {
      terminal.resize(parsed.cols, parsed.rows);
    }
  } catch {
    await terminal.write(message);
  }
}

export function onClose(
  ws: ServerWebSocket,
  _code: number,
  _reason: string,
  _ctx: WebSocketContext
) {
  const { sessionId, terminalId } = getCustomData(ws);

  if (!sessionId || !terminalId) return;

  const session = sessionManager.getSession(sessionId);
  if (session) {
    sessionManager.disposeTerminal(sessionId, terminalId).catch(() => {});
  }
}
