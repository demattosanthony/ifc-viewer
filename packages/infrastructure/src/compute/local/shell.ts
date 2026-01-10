import type {
  PythonTerminalOptions,
  Shell,
  TerminalOptions,
  TerminalSession,
} from "@ifc-viewer/core"

const isWindows = process.platform === "win32"
const DEFAULT_SHELL = isWindows ? "powershell.exe" : "/bin/bash"
const DEFAULT_ARGS = isWindows ? [] : ["--norc", "--noprofile"]

// Filter undefined values from process.env
const baseEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
)

export class LocalShell implements Shell {
  constructor(
    private workDir: string,
    private defaultEnv?: Record<string, string>
  ) {}

  async startTerminal(options?: TerminalOptions): Promise<TerminalSession> {
    const cwd = options?.cwd || this.workDir

    const env: Record<string, string> = {
      ...baseEnv,
      ...this.defaultEnv,
      ...options?.env,
      SHELL: DEFAULT_SHELL,
      // Bash-specific settings
      ...(!isWindows && {
        PS1: "\\[\\033[36m\\]$\\[\\033[0m\\] ",
        BASH_SILENCE_DEPRECATION_WARNING: "1",
      }),
    }

    const id = `terminal-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const dataCallbacks: Array<(data: string) => void> = []
    const exitCallbacks: Array<(code: number) => void> = []
    const decoder = new TextDecoder()
    let killed = false

    const proc = Bun.spawn([DEFAULT_SHELL, ...DEFAULT_ARGS], {
      cwd,
      env,
      terminal: {
        cols: options?.cols ?? 80,
        rows: options?.rows ?? 24,
        data: (_, data) => {
          if (killed) return
          const text = decoder.decode(data)
          for (const cb of dataCallbacks) cb(text)
        },
      },
    })

    const terminal = proc.terminal
    if (!terminal) throw new Error("Failed to create PTY terminal")

    proc.exited
      .then((code) => {
        for (const cb of exitCallbacks) cb(code)
        // Clear callbacks after exit handlers have fired
        dataCallbacks.length = 0
        exitCallbacks.length = 0
      })
      .catch(() => {})

    return {
      id,
      write: async (data: string) => void terminal.write(data),
      resize: (cols: number, rows: number) => terminal.resize(cols, rows),
      kill: async (signal?: number) => {
        killed = true
        terminal.close()
        proc.kill(signal)
      },
      onData: (callback: (data: string) => void) => {
        dataCallbacks.push(callback)
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

  async startPythonTerminal(options?: PythonTerminalOptions): Promise<TerminalSession> {
    const cwd = options?.cwd || this.workDir

    const env: Record<string, string> = {
      ...baseEnv,
      ...this.defaultEnv,
      ...options?.env,
      PYTHONUNBUFFERED: "1",
      PYTHONDONTWRITEBYTECODE: "1",
    }

    const id = `python-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const dataCallbacks: Array<(data: string) => void> = []
    const exitCallbacks: Array<(code: number) => void> = []
    const decoder = new TextDecoder()
    let killed = false

    // Start Python in interactive quiet mode
    const proc = Bun.spawn(["python3", "-i", "-q"], {
      cwd,
      env,
      terminal: {
        cols: options?.cols ?? 120,
        rows: options?.rows ?? 24,
        data: (_, data) => {
          if (killed) return
          const text = decoder.decode(data)
          for (const cb of dataCallbacks) cb(text)
        },
      },
    })

    const terminal = proc.terminal
    if (!terminal) throw new Error("Failed to create Python PTY terminal")

    proc.exited
      .then((code) => {
        for (const cb of exitCallbacks) cb(code)
        dataCallbacks.length = 0
        exitCallbacks.length = 0
      })
      .catch(() => {})

    const terminalSession: TerminalSession = {
      id,
      write: async (data: string) => void terminal.write(data),
      resize: (cols: number, rows: number) => terminal.resize(cols, rows),
      kill: async (signal?: number) => {
        killed = true
        terminal.close()
        proc.kill(signal)
      },
      onData: (callback: (data: string) => void) => {
        dataCallbacks.push(callback)
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
        await terminalSession.write(`${stmt}\n`)
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
