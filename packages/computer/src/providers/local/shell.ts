import type { Shell, TerminalSession, TerminalOptions } from "../../types";

interface BunTerminal {
  write(data: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  close(): void;
}

export class LocalShell implements Shell {
  constructor(
    private workDir: string,
    private defaultEnv?: Record<string, string>
  ) {}

  async startTerminal(options?: TerminalOptions): Promise<TerminalSession> {
    const cwd = options?.cwd || this.workDir;
    const isWindows = process.platform === "win32";

    const shell = isWindows ? "powershell.exe" : "/bin/bash";
    const args = isWindows ? [] : ["--norc", "--noprofile"];

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...this.defaultEnv,
      ...options?.env,
      TERM: "xterm-256color",
      SHELL: shell,
      HOME: cwd, // Set HOME so ~ shows as workspace root
      PS1: "\\[\\033[90m\\]\\w\\[\\033[0m\\] \\[\\033[36m\\]>\\[\\033[0m\\] ",
      BASH_SILENCE_DEPRECATION_WARNING: "1",
    };

    const sessionId = `terminal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const dataCallbacks: Array<(data: string) => void> = [];
    const exitCallbacks: Array<(code: number) => void> = [];
    let ptyTerminal: BunTerminal | null = null;

    const proc = Bun.spawn([shell, ...args], {
      cwd,
      env,
      terminal: {
        cols: options?.cols || 80,
        rows: options?.rows || 24,
        data(terminal, data) {
          ptyTerminal = terminal as BunTerminal;
          const text = new TextDecoder().decode(data);
          for (const cb of dataCallbacks) {
            cb(text);
          }
        },
      },
    });

    const procTerminal = (proc as unknown as { terminal: BunTerminal }).terminal;
    if (!procTerminal) {
      throw new Error("Failed to create PTY terminal");
    }

    proc.exited.then((code) => {
      for (const cb of exitCallbacks) {
        cb(code);
      }
    });

    const getTerminal = () => ptyTerminal || procTerminal;

    return {
      id: sessionId,

      async write(data: string): Promise<void> {
        getTerminal().write(data);
      },

      resize(cols: number, rows: number): void {
        getTerminal().resize(cols, rows);
      },

      async kill(): Promise<void> {
        getTerminal().close();
        proc.kill();
      },

      onData(callback: (data: string) => void): () => void {
        dataCallbacks.push(callback);
        return () => {
          const idx = dataCallbacks.indexOf(callback);
          if (idx > -1) dataCallbacks.splice(idx, 1);
        };
      },

      onExit(callback: (code: number) => void): () => void {
        exitCallbacks.push(callback);
        return () => {
          const idx = exitCallbacks.indexOf(callback);
          if (idx > -1) exitCallbacks.splice(idx, 1);
        };
      },
    };
  }
}
