/**
 * Terminal WebSocket Routes
 *
 * Provides WebSocket-based terminal access to project compute instances.
 * Creates compute on-demand when terminal is opened, keeps it alive while in use.
 */

import { Elysia, t } from "elysia"
import type { Context, TerminalServerEvent, TerminalClientMessage } from "@ifc-viewer/core"
import { createLogger } from "@ifc-viewer/logger"

const log = createLogger("terminal")

/** Send typed event to WebSocket */
const send = (ws: { send: (data: string) => void }, event: TerminalServerEvent) =>
  ws.send(JSON.stringify(event))

export function terminalRoutes(ctx: Context) {
  return new Elysia({ prefix: "/ws" }).ws("/terminal", {
    query: t.Object({ projectId: t.String() }),

    async open(ws) {
      const { projectId } = ws.data.query
      let terminalId: string | undefined
      let unsubData: (() => void) | undefined
      let unsubExit: (() => void) | undefined

      log.debug("Terminal connection opened", { projectId })

      try {
        const project = await ctx.db.projects.findById(projectId)
        if (!project) {
          send(ws, { type: "error", message: "Project not found" })
          return ws.close()
        }

        const { computer } = await ctx.getOrCreateCompute(projectId)
        const terminal = await computer.createTerminal()
        terminalId = terminal.id

        // Store cleanup functions on ws.data for close handler
        ;(ws.data as Record<string, unknown>).terminalId = terminalId

        unsubData = terminal.onData((data) => {
          if (ws.readyState === 1) {
            send(ws, { type: "output", data: data.replace(/\x1b\[\?1034h/g, "") })
          }
        })
        ;(ws.data as Record<string, unknown>).unsubData = unsubData

        unsubExit = terminal.onExit((code) => {
          if (ws.readyState === 1) {
            send(ws, { type: "exit", code })
            ws.close()
          }
        })
        ;(ws.data as Record<string, unknown>).unsubExit = unsubExit

        send(ws, { type: "ready", terminalId })
      } catch (error) {
        log.error("Failed to create terminal", { projectId, error })
        send(ws, { type: "error", message: error instanceof Error ? error.message : "Failed to create terminal" })
        ws.close()
      }
    },

    async message(ws, rawMessage) {
      const { projectId } = ws.data.query
      const terminalId = (ws.data as Record<string, unknown>).terminalId as string | undefined

      if (!terminalId) return send(ws, { type: "error", message: "Terminal not initialized" })

      const computer = ctx.getCompute(projectId)
      if (!computer) return send(ws, { type: "error", message: "Compute not found" })

      const terminal = computer.getTerminal(terminalId)
      if (!terminal) return send(ws, { type: "error", message: "Terminal not found" })

      try {
        const message = (typeof rawMessage === "string" ? JSON.parse(rawMessage) : rawMessage) as TerminalClientMessage

        if (message.type === "input" && message.data) {
          ctx.touchCompute(projectId)
          await terminal.write(message.data)
        } else if (message.type === "resize" && message.cols && message.rows) {
          terminal.resize(message.cols, message.rows)
        }
      } catch (error) {
        log.error("Error processing terminal message", { projectId, error })
      }
    },

    async close(ws) {
      const { projectId } = ws.data.query
      const data = ws.data as Record<string, unknown>
      const terminalId = data.terminalId as string | undefined

      log.debug("Terminal connection closed", { projectId, terminalId })

      ;(data.unsubData as (() => void) | undefined)?.()
      ;(data.unsubExit as (() => void) | undefined)?.()

      if (terminalId) {
        await ctx.getCompute(projectId)?.disposeTerminal(terminalId)
      }
    },
  })
}
