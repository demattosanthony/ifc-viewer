import type { Shell, TerminalSession, TerminalOptions } from "../../types";

export class LocalShell implements Shell {
  constructor(
    private workDir: string,
    private defaultEnv?: Record<string, string>
  ) {}

  async startTerminal(options?: TerminalOptions): Promise<TerminalSession> {
    const cwd = options?.cwd || this.workDir;
    const env = {
      ...process.env,
      ...this.defaultEnv,
      ...options?.env,
      // Suppress macOS bash deprecation warning
      BASH_SILENCE_DEPRECATION_WARNING: "1",
      // Clear prompt for cleaner output
      PS1: "",
    };

    // Use --norc and --noprofile to skip startup files
    // No -i flag - we want non-interactive mode for programmatic execution
    const proc = Bun.spawn(["bash", "--norc", "--noprofile"], {
      cwd,
      env,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    const sessionId = `terminal-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;
    const dataCallbacks: Array<(data: string) => void> = [];
    const exitCallbacks: Array<(code: number) => void> = [];

    // Stream stdout
    (async () => {
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          dataCallbacks.forEach((cb) => cb(text));
        }
      } catch {
        // Stream closed
      }
    })();

    // Stream stderr (combine with stdout for terminal)
    (async () => {
      const reader = proc.stderr.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          dataCallbacks.forEach((cb) => cb(text));
        }
      } catch {
        // Stream closed
      }
    })();

    // Handle exit
    proc.exited.then((code) => {
      exitCallbacks.forEach((cb) => cb(code));
    });

    const encoder = new TextEncoder();

    return {
      id: sessionId,

      async write(data: string): Promise<void> {
        proc.stdin.write(encoder.encode(data));
      },

      async kill(signal?: number): Promise<void> {
        proc.kill(signal);
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
