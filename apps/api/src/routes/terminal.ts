import { Elysia, t } from "elysia";
import type { AppContext } from "../context";
import type {
  TerminalServerEvent,
  TerminalClientMessage,
} from "@ifc-viewer/realtime";

interface TerminalWSData {
  query: { sessionId: string };
  terminalId?: string;
  unsubData?: () => void;
  unsubExit?: () => void;
}

/**
 * Terminal WebSocket routes
 */
export function terminalRoutes(ctx: AppContext) {
  return new Elysia({ prefix: "/ws" }).ws("/terminal", {
    query: t.Object({
      sessionId: t.String(),
    }),

    async open(ws) {
      const data = ws.data as TerminalWSData;
      const sessionId = data.query.sessionId;
      const computer = ctx.getComputer(sessionId);

      try {
        // Create a new terminal
        const terminal = await computer.createTerminal();

        // Store terminal ID in ws data for later use
        data.terminalId = terminal.id;

        // Set up terminal event handlers
        data.unsubData = terminal.onData((output: string) => {
          if (ws.readyState === 1) {
            // Filter out terminal initialization escape sequence
            const cleanData = output.replace(/\x1b\[\?1034h/g, "");
            ws.send(
              JSON.stringify({
                type: "output",
                data: cleanData,
              } satisfies TerminalServerEvent)
            );
          }
        });

        data.unsubExit = terminal.onExit((code: number) => {
          if (ws.readyState === 1) {
            ws.send(
              JSON.stringify({
                type: "exit",
                code,
              } satisfies TerminalServerEvent)
            );
            ws.close();
          }
        });

        // Send ready event
        ws.send(
          JSON.stringify({
            type: "ready",
            terminalId: terminal.id,
          } satisfies TerminalServerEvent)
        );
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to create terminal",
          } satisfies TerminalServerEvent)
        );
        ws.close();
      }
    },

    async message(ws, rawMessage) {
      const data = ws.data as TerminalWSData;
      const sessionId = data.query.sessionId;
      const terminalId = data.terminalId;

      if (!terminalId) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Terminal not initialized",
          } satisfies TerminalServerEvent)
        );
        return;
      }

      const computer = ctx.getComputer(sessionId);
      const terminal = computer.getTerminal(terminalId);

      if (!terminal) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Terminal not found",
          } satisfies TerminalServerEvent)
        );
        return;
      }

      try {
        // Elysia WebSocket may already parse JSON messages, so check if it's already an object
        let message: TerminalClientMessage;
        if (
          typeof rawMessage === "object" &&
          rawMessage !== null &&
          !Buffer.isBuffer(rawMessage)
        ) {
          message = rawMessage as TerminalClientMessage;
        } else {
          const messageStr =
            typeof rawMessage === "string"
              ? rawMessage
              : rawMessage instanceof Buffer
                ? rawMessage.toString()
                : String(rawMessage);
          message = JSON.parse(messageStr);
        }

        if (message.type === "input" && message.data) {
          await terminal.write(message.data);
        } else if (message.type === "resize" && message.cols && message.rows) {
          terminal.resize(message.cols, message.rows);
        }
      } catch (error) {
        console.error("[Terminal] Error processing message:", error);
      }
    },

    async close(ws) {
      const data = ws.data as TerminalWSData;
      const sessionId = data.query.sessionId;
      const terminalId = data.terminalId;

      // Clean up subscriptions
      data.unsubData?.();
      data.unsubExit?.();

      // Dispose terminal
      if (terminalId) {
        const computer = ctx.getComputer(sessionId);
        await computer.disposeTerminal(terminalId);
      }
    },
  });
}
