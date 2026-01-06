import { Elysia, t } from "elysia"
import type { Context, TerminalServerEvent, TerminalClientMessage } from "@ifc-viewer/core"

interface TerminalWSData {
  query: { workspaceId: string }
  terminalId?: string
  unsubData?: () => void
  unsubExit?: () => void
  unregisterConnection?: () => void
}

export function terminalRoutes(ctx: Context) {
  return new Elysia({ prefix: "/ws" }).ws("/terminal", {
    query: t.Object({
      workspaceId: t.String(),
    }),

    async open(ws) {
      const data = ws.data as TerminalWSData
      const workspaceId = data.query.workspaceId

      try {
        // Get workspace to ensure it exists and get working directory
        const workspace = await ctx.db.workspaces.findById(workspaceId)
        if (!workspace) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Workspace not found",
            } satisfies TerminalServerEvent)
          )
          ws.close()
          return
        }

        // Register this connection for lifecycle tracking
        data.unregisterConnection = ctx.registerConnection(workspaceId)

        const computer = await ctx.getOrCreateCompute(workspace.id, workspace.workingDirectory)
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
      if (!computer) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Workspace compute not found",
          } satisfies TerminalServerEvent)
        )
        return
      }
      
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
        if (computer) {
          await computer.disposeTerminal(terminalId)
        }
      }

      // Unregister connection - this may trigger workspace cleanup if last connection
      data.unregisterConnection?.()
    },
  })
}
