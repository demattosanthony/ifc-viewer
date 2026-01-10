/**
 * Shell Tools
 *
 * AI tools for shell command execution.
 * Automatically detects file changes after command execution via snapshot diff.
 */

import { tool } from "ai"
import { z } from "zod"
import type { TerminalSession, AIEvent, ChangeTracker } from "@ifc-viewer/core"
import { getErrorMessage, stripAnsi } from "../utils"

const MARKER_PREFIX = "<<CMD_DONE:"
const MARKER_SUFFIX = ">>"
const MARKER_REGEX = /<<CMD_DONE:(-?\d+)>>/

export interface ShellToolsOptions {
  getTerminal: () => Promise<TerminalSession>
  changeTracker: ChangeTracker
  emit: (event: AIEvent) => void
}

export function createShellTools(options: ShellToolsOptions) {
  const { getTerminal, changeTracker, emit } = options

  return {
    executeCommand: tool({
      description: `Execute a shell command in the terminal.
Use this for running scripts, installing packages, or any command-line operations.
The command runs in a persistent bash shell in the workspace directory.
IMPORTANT: Avoid interactive commands that require user input - they will hang.
Commands run sequentially and share environment/state between calls.`,
      inputSchema: z.object({
        title: z
          .string()
          .describe(
            "A short 2-4 word description of what this command does for non-technical users (e.g. 'List project files', 'Run analysis script', 'Install dependencies')"
          ),
        command: z.string().describe("The command to execute"),
        timeout: z
          .number()
          .default(30000)
          .describe("Timeout in milliseconds (default: 30000)"),
      }),
      execute: async ({
        title: _title,
        command,
        timeout,
      }: {
        title: string
        command: string
        timeout: number
      }) => {
        try {
          emit({ type: "terminal-focus" })
          emit({ type: "terminal-execute" })

          // Snapshot file state before command
          const beforeSnapshot = await changeTracker.snapshot()

          const terminal = await getTerminal()
          const marker = `${MARKER_PREFIX}$?${MARKER_SUFFIX}`

          let output = ""
          let exitCode: number | null = null
          let skippedEcho = false

          const isEchoLine = (line: string) => {
            const clean = stripAnsi(line)
            return (
              clean.includes('echo "<<CMD_DONE:$?>>"') ||
              clean.includes("echo '<<CMD_DONE:$?>>'")
            )
          }

          let cleanup: (() => void) | null = null

          const outputPromise = new Promise<{
            output: string
            exitCode: number
          }>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              if (cleanup) {
                cleanup()
                cleanup = null
              }
              reject(new Error(`Command timed out after ${timeout}ms`))
            }, timeout)

            cleanup = terminal.onData((data: string) => {
              if (!skippedEcho) {
                const lines = data.split("\n")
                const hasEchoLine = lines.some(isEchoLine)
                if (hasEchoLine) {
                  skippedEcho = true
                  const filteredLines = lines.filter((line: string) => !isEchoLine(line))
                  const cleanData = filteredLines.join("\n")
                  if (cleanData && cleanData.trim()) {
                    output += cleanData
                    emit({ type: "terminal-output", data: cleanData })
                  }
                  return
                }
              }

              const match = data.match(MARKER_REGEX)
              if (match && match[1]) {
                exitCode = parseInt(match[1], 10)
                const lines = data.split("\n")
                const cleanLines = lines.filter((line: string) => !MARKER_REGEX.test(line))
                const cleanData = cleanLines.join("\n")
                if (cleanData && cleanData.trim()) {
                  output += cleanData
                  emit({ type: "terminal-output", data: cleanData })
                }

                clearTimeout(timeoutId)
                if (cleanup) {
                  cleanup()
                  cleanup = null
                }

                resolve({ output: output.trim(), exitCode })
              } else {
                output += data
                emit({ type: "terminal-output", data })
              }
            })
          })

          await terminal.write(`${command}; echo "${marker}"\n`)

          const result = await outputPromise

          // Detect file changes after command completes
          const changes = await changeTracker.detectChanges(beforeSnapshot)
          for (const change of changes) {
            // Sync to storage immediately so file browser can see changes
            await changeTracker.sync(change)
            // Emit events for UI updates
            if (change.type === "create" || change.type === "update") {
              emit({ type: "file-created", path: change.path })
            } else if (change.type === "delete") {
              emit({ type: "file-deleted", path: change.path })
            }
          }

          return {
            success: result.exitCode === 0,
            output: stripAnsi(result.output),
            exitCode: result.exitCode,
            command,
            filesChanged: changes.length,
          }
        } catch (error) {
          const errorMessage = getErrorMessage(error)
          emit({
            type: "terminal-output",
            data: `\x1b[31mError: ${errorMessage}\x1b[0m\n`,
          })
          return {
            success: false,
            error: errorMessage,
            command,
          }
        }
      },
    }),
  }
}
