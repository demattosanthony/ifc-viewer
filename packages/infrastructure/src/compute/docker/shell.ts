import type { Shell, TerminalSession, TerminalOptions } from "@ifc-viewer/core"
import type { Container } from "dockerode"
import { spawn, type ChildProcess } from "child_process"
import { createInterface, type Interface } from "readline"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

/**
 * Message types for communication with the terminal worker
 */
interface WorkerMessage {
  type: "ready" | "data" | "exit" | "error"
  data?: string // base64 encoded for "data" type
  code?: number // exit code for "exit" type
  message?: string // error message for "error" type
}

interface InitMessage {
  type: "init"
  containerId: string
  options: {
    cwd: string
    env?: Record<string, string>
    cols?: number
    rows?: number
  }
}

interface InputMessage {
  type: "input"
  data: string // base64 encoded
}

interface ResizeMessage {
  type: "resize"
  cols: number
  rows: number
}

interface KillMessage {
  type: "kill"
}

type ParentMessage = InitMessage | InputMessage | ResizeMessage | KillMessage

/**
 * Get the path to the terminal worker script
 */
function getWorkerPath(): string {
  // In ESM, we need to resolve relative to this file
  const currentFile = fileURLToPath(import.meta.url)
  const currentDir = dirname(currentFile)
  return join(currentDir, "terminal-worker.cjs")
}

/**
 * Docker-based Shell implementation using Node.js worker for TTY support
 *
 * Spawns a Node.js child process to handle Docker's hijack protocol,
 * communicating via newline-delimited JSON over stdin/stdout.
 */
export class DockerShell implements Shell {
  constructor(
    private container: Container,
    private workDir: string,
    private defaultEnv?: Record<string, string>
  ) {}

  async startTerminal(options?: TerminalOptions): Promise<TerminalSession> {
    const cwd = options?.cwd || this.workDir
    const id = `terminal-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const dataCallbacks: Array<(data: string) => void> = []
    const exitCallbacks: Array<(code: number) => void> = []

    let worker: ChildProcess | null = null
    let readline: Interface | null = null
    let killed = false
    let isReady = false

    // Pending data buffer for messages received before onData is registered
    const pendingData: string[] = []

    // Helper to emit data to callbacks
    const emitData = (text: string) => {
      if (killed) return

      if (dataCallbacks.length === 0) {
        // Buffer data until callbacks are registered
        pendingData.push(text)
        return
      }

      for (const cb of dataCallbacks) {
        try {
          cb(text)
        } catch {
          // Ignore callback errors
        }
      }
    }

    // Helper to emit exit to callbacks
    const emitExit = (code: number) => {
      if (killed) return

      for (const cb of exitCallbacks) {
        try {
          cb(code)
        } catch {
          // Ignore callback errors
        }
      }
    }

    // Helper to send message to worker
    const sendToWorker = (message: ParentMessage) => {
      if (!worker || killed) return
      worker.stdin?.write(JSON.stringify(message) + "\n")
    }

    // Spawn the Node.js worker process
    const workerPath = getWorkerPath()
    worker = spawn("node", [workerPath], {
      stdio: ["pipe", "pipe", "pipe"],
    })

    // Set up readline for newline-delimited JSON from worker
    if (worker.stdout) {
      readline = createInterface({
        input: worker.stdout,
        terminal: false,
      })

      readline.on("line", (line) => {
        try {
          const message: WorkerMessage = JSON.parse(line)

          switch (message.type) {
            case "ready":
              isReady = true
              break
            case "data":
              if (message.data) {
                const text = Buffer.from(message.data, "base64").toString("utf-8")
                emitData(text)
              }
              break
            case "exit":
              emitExit(message.code ?? 0)
              break
            case "error":
              console.error("[DockerShell] Worker error:", message.message)
              break
          }
        } catch (err) {
          console.error("[DockerShell] Failed to parse worker message:", err)
        }
      })
    }

    // Log stderr from worker for debugging
    if (worker.stderr) {
      worker.stderr.on("data", (chunk: Buffer) => {
        console.error("[DockerShell Worker]", chunk.toString("utf-8"))
      })
    }

    // Handle worker exit
    worker.on("exit", (code) => {
      if (!killed) {
        emitExit(code ?? 0)
      }
      worker = null
      readline?.close()
      readline = null
    })

    worker.on("error", (err) => {
      console.error("[DockerShell] Worker process error:", err)
    })

    // Get container ID
    const containerId = this.container.id

    // Initialize the terminal in the worker
    sendToWorker({
      type: "init",
      containerId,
      options: {
        cwd,
        env: {
          ...(this.defaultEnv || {}),
          ...(options?.env || {}),
        },
        cols: options?.cols,
        rows: options?.rows,
      },
    })

    // Wait for ready signal
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Terminal worker initialization timeout"))
      }, 10000)

      const checkReady = setInterval(() => {
        if (isReady) {
          clearTimeout(timeout)
          clearInterval(checkReady)
          resolve()
        }
        if (killed || !worker) {
          clearTimeout(timeout)
          clearInterval(checkReady)
          reject(new Error("Terminal worker died during initialization"))
        }
      }, 50)
    })

    return {
      id,

      write: async (data: string) => {
        if (killed || !worker) return

        // Send raw input to the worker (it goes directly to the PTY)
        sendToWorker({
          type: "input",
          data: Buffer.from(data, "utf-8").toString("base64"),
        })
      },

      resize: (cols: number, rows: number) => {
        if (killed || !worker) return

        sendToWorker({
          type: "resize",
          cols,
          rows,
        })
      },

      kill: async () => {
        if (killed) return
        killed = true

        sendToWorker({ type: "kill" })

        // Give worker time to clean up, then force kill
        setTimeout(() => {
          if (worker) {
            worker.kill("SIGKILL")
            worker = null
          }
        }, 1000)

        dataCallbacks.length = 0
        exitCallbacks.length = 0
      },

      onData: (callback: (data: string) => void) => {
        dataCallbacks.push(callback)

        // Flush any pending data to the new callback
        if (pendingData.length > 0) {
          queueMicrotask(() => {
            for (const data of pendingData) {
              try {
                callback(data)
              } catch {
                // Ignore callback errors
              }
            }
            pendingData.length = 0
          })
        }

        return () => {
          const idx = dataCallbacks.indexOf(callback)
          if (idx > -1) dataCallbacks.splice(idx, 1)
        }
      },

      onExit: (callback: (code: number) => void) => {
        exitCallbacks.push(callback)
        return () => {
          const idx = exitCallbacks.indexOf(callback)
          if (idx > -1) exitCallbacks.splice(idx, 1)
        }
      },
    }
  }
}
