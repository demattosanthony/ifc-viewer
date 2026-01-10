import type {
  Shell,
  TerminalSession,
  TerminalOptions,
  PythonTerminalOptions,
} from "@ifc-viewer/core"
import { createLogger } from "@ifc-viewer/logger"
import type { Container } from "dockerode"
import { spawn, type ChildProcess } from "child_process"
import { createInterface, type Interface } from "readline"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const log = createLogger("docker:shell")

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
    command?: string[]
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

function getWorkerPath(): string {
  const currentFile = fileURLToPath(import.meta.url)
  const currentDir = dirname(currentFile)
  return join(currentDir, "terminal-worker.cjs")
}

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

    const pendingData: string[] = []

    const emitData = (text: string) => {
      if (killed) return

      if (dataCallbacks.length === 0) {
        pendingData.push(text)
        return
      }

      for (const cb of dataCallbacks) {
        try {
          cb(text)
        } catch {}
      }
    }

    const emitExit = (code: number) => {
      if (killed) return

      for (const cb of exitCallbacks) {
        try {
          cb(code)
        } catch {}
      }
    }

    const sendToWorker = (message: ParentMessage) => {
      if (!worker || killed) return
      worker.stdin?.write(JSON.stringify(message) + "\n")
    }

    const workerPath = getWorkerPath()
    worker = spawn("node", [workerPath], {
      stdio: ["pipe", "pipe", "pipe"],
    })

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
              log.error("Worker error", { message: message.message })
              break
          }
        } catch (err) {
          log.error("Failed to parse worker message", { error: err })
        }
      })
    }

    if (worker.stderr) {
      worker.stderr.on("data", (chunk: Buffer) => {
        log.debug("Worker stderr", { output: chunk.toString("utf-8") })
      })
    }

    worker.on("exit", (code) => {
      if (!killed) {
        emitExit(code ?? 0)
      }
      worker = null
      readline?.close()
      readline = null
    })

    worker.on("error", (err) => {
      log.error("Worker process error", { error: err })
    })

    const containerId = this.container.id

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

        if (pendingData.length > 0) {
          queueMicrotask(() => {
            for (const data of pendingData) {
              try {
                callback(data)
              } catch {}
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

  async startPythonTerminal(
    options?: PythonTerminalOptions
  ): Promise<TerminalSession> {
    const cwd = options?.cwd || this.workDir
    const id = `python-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const dataCallbacks: Array<(data: string) => void> = []
    const exitCallbacks: Array<(code: number) => void> = []

    let worker: ChildProcess | null = null
    let readline: Interface | null = null
    let killed = false
    let isReady = false

    const pendingData: string[] = []

    const emitData = (text: string) => {
      if (killed) return

      if (dataCallbacks.length === 0) {
        pendingData.push(text)
        return
      }

      for (const cb of dataCallbacks) {
        try {
          cb(text)
        } catch {}
      }
    }

    const emitExit = (code: number) => {
      if (killed) return

      for (const cb of exitCallbacks) {
        try {
          cb(code)
        } catch {}
      }
    }

    const sendToWorker = (message: ParentMessage) => {
      if (!worker || killed) return
      worker.stdin?.write(JSON.stringify(message) + "\n")
    }

    const workerPath = getWorkerPath()
    worker = spawn("node", [workerPath], {
      stdio: ["pipe", "pipe", "pipe"],
    })

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
              log.error("Worker error", { message: message.message })
              break
          }
        } catch (err) {
          log.error("Failed to parse worker message", { error: err })
        }
      })
    }

    if (worker.stderr) {
      worker.stderr.on("data", (chunk: Buffer) => {
        log.debug("Worker stderr", { output: chunk.toString("utf-8") })
      })
    }

    worker.on("exit", (code) => {
      if (!killed) {
        emitExit(code ?? 0)
      }
      worker = null
      readline?.close()
      readline = null
    })

    worker.on("error", (err) => {
      log.error("Worker process error", { error: err })
    })

    const containerId = this.container.id

    sendToWorker({
      type: "init",
      containerId,
      options: {
        cwd,
        env: {
          ...(this.defaultEnv || {}),
          ...(options?.env || {}),
          PYTHONUNBUFFERED: "1",
          PYTHONDONTWRITEBYTECODE: "1",
        },
        cols: options?.cols,
        rows: options?.rows,
        command: ["python3", "-i", "-q"],
      },
    })

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Python terminal worker initialization timeout"))
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
          reject(new Error("Python terminal worker died during initialization"))
        }
      }, 50)
    })

    const terminalSession: TerminalSession = {
      id,

      write: async (data: string) => {
        if (killed || !worker) return

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

        if (pendingData.length > 0) {
          queueMicrotask(() => {
            for (const data of pendingData) {
              try {
                callback(data)
              } catch {}
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

    // Wait for Python REPL to be ready (>>> prompt)
    await this.waitForPythonPrompt(terminalSession)

    // Execute pre-imports if provided
    if (options?.preImports?.length) {
      for (const stmt of options.preImports) {
        await terminalSession.write(stmt + "\n")
        await this.waitForPythonPrompt(terminalSession)
      }
    }

    return terminalSession
  }

  private waitForPythonPrompt(session: TerminalSession): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error("Python startup timeout"))
      }, 15000)

      let buffer = ""
      const cleanup = session.onData((data) => {
        buffer += data
        // Check for >>> prompt (Python ready)
        if (buffer.includes(">>> ")) {
          clearTimeout(timeout)
          cleanup()
          resolve()
        }
      })
    })
  }
}
