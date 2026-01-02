import { Elysia, t } from "elysia"
import type { Context } from "@ifc-viewer/core"
import type { TerminalServerEvent, TerminalClientMessage } from "@ifc-viewer/realtime"

interface TerminalWSData {
  query: { workspaceId: string }
  terminalId?: string
  unsubData?: () => void
  unsubExit?: () => void
}

export function terminalRoutes(ctx: Context) {
  return new Elysia({ prefix: "/ws" }).ws("/terminal", {
    query: t.Object({
      workspaceId: t.String(),
    }),

    async open(ws) {
      const data = ws.data as TerminalWSData
      const workspaceId = data.query.workspaceId
      const computer = ctx.getCompute(workspaceId)

      try {
        const terminal = await computer.createTerminal()
        data.terminalId = terminal.id

        data.unsubData = terminal.onData((output: string) => {
          if (ws.readyState === 1) {
            const cleanData = output.replace(/\x1b\[\?1034h/g, "")
            ws.send(
              JSON.stringify({
                type: "output",
                data: cleanData,
              } satisfies TerminalServerEvent)
            )
          }
        })

        data.unsubExit = terminal.onExit((code: number) => {
          if (ws.readyState === 1) {
            ws.send(
              JSON.stringify({
                type: "exit",
                code,
              } satisfies TerminalServerEvent)
            )
            ws.close()
          }
        })

        ws.send(
          JSON.stringify({
            type: "ready",
            terminalId: terminal.id,
          } satisfies TerminalServerEvent)
        )
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "Failed to create terminal",
          } satisfies TerminalServerEvent)
        )
        ws.close()
      }
    },

    async message(ws, rawMessage) {
      const data = ws.data as TerminalWSData
      const workspaceId = data.query.workspaceId
      const terminalId = data.terminalId

      if (!terminalId) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Terminal not initialized",
          } satisfies TerminalServerEvent)
        )
        return
      }

      const computer = ctx.getCompute(workspaceId)
      const terminal = computer.getTerminal(terminalId)

      if (!terminal) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Terminal not found",
          } satisfies TerminalServerEvent)
        )
        return
      }

      try {
        let message: TerminalClientMessage
        if (typeof rawMessage === "object" && rawMessage !== null && !Buffer.isBuffer(rawMessage)) {
          message = rawMessage as TerminalClientMessage
        } else {
          const messageStr =
            typeof rawMessage === "string"
              ? rawMessage
              : rawMessage instanceof Buffer
                ? rawMessage.toString()
                : String(rawMessage)
          message = JSON.parse(messageStr)
        }

        if (message.type === "input" && message.data) {
          await terminal.write(message.data)
        } else if (message.type === "resize" && message.cols && message.rows) {
          terminal.resize(message.cols, message.rows)
        }
      } catch (error) {
        console.error("[Terminal] Error processing message:", error)
      }
    },

    async close(ws) {
      const data = ws.data as TerminalWSData
      const workspaceId = data.query.workspaceId
      const terminalId = data.terminalId

      data.unsubData?.()
      data.unsubExit?.()

      if (terminalId) {
        const computer = ctx.getCompute(workspaceId)
        await computer.disposeTerminal(terminalId)
      }
    },
  })
}
