import type {
  Computer,
  ComputerConfig,
  FileSystem,
  Shell,
  TerminalSession,
} from "../../types";
import { mkdir, rm } from "node:fs/promises";
import { LocalFileSystem } from "./filesystem";
import { LocalShell } from "./shell";

/**
 * Local computer implementation using Bun native APIs
 */
export class LocalComputer implements Computer {
  readonly id: string;
  readonly workingDirectory: string;

  private readonly cleanup: boolean;
  private _files: FileSystem;
  private _shell: Shell;

  // Terminal management
  private terminals = new Map<string, TerminalSession>();
  private agentTerminal: TerminalSession | null = null;

  constructor(config: ComputerConfig) {
    this.id = `computer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.workingDirectory = config.workingDirectory;
    this.cleanup = config.cleanup ?? false;

    this._files = new LocalFileSystem(config.workingDirectory);
    this._shell = new LocalShell(config.workingDirectory, config.environment);
  }

  /**
   * Initialize the computer (create working directory)
   */
  async init(): Promise<void> {
    await mkdir(this.workingDirectory, { recursive: true });
  }

  get files(): FileSystem {
    return this._files;
  }

  get shell(): Shell {
    return this._shell;
  }

  // Terminal management methods

  async createTerminal(): Promise<TerminalSession> {
    const terminal = await this._shell.startTerminal();
    this.terminals.set(terminal.id, terminal);
    return terminal;
  }

  getTerminal(id: string): TerminalSession | undefined {
    return this.terminals.get(id);
  }

  getAllTerminals(): TerminalSession[] {
    return Array.from(this.terminals.values());
  }

  async disposeTerminal(id: string): Promise<void> {
    const terminal = this.terminals.get(id);
    if (!terminal) return;

    await terminal.kill();
    this.terminals.delete(id);

    // Clear agent terminal reference if this was it
    if (this.agentTerminal?.id === id) {
      this.agentTerminal = null;
    }
  }

  async getOrCreateAgentTerminal(): Promise<TerminalSession> {
    if (this.agentTerminal) {
      return this.agentTerminal;
    }

    const terminal = await this._shell.startTerminal();
    this.terminals.set(terminal.id, terminal);
    this.agentTerminal = terminal;
    return terminal;
  }

  hasAgentTerminal(): boolean {
    return this.agentTerminal !== null;
  }

  async dispose(): Promise<void> {
    // Kill all terminals
    const terminalsToKill = Array.from(this.terminals.values());
    await Promise.all(terminalsToKill.map((t) => t.kill()));
    this.terminals.clear();
    this.agentTerminal = null;

    // Cleanup workspace if configured
    if (this.cleanup) {
      await rm(this.workingDirectory, { recursive: true, force: true }).catch(
        () => {}
      );
    }
  }
}

/**
 * Create a local computer instance
 *
 * @example
 * ```ts
 * import { createLocalComputer } from '@ifc-viewer/compute';
 *
 * const computer = await createLocalComputer({
 *   workingDirectory: '/tmp/my-workspace',
 * });
 *
 * // Write a file
 * await computer.files.write('/hello.txt', 'Hello World!');
 *
 * // Start an interactive terminal
 * const terminal = await computer.createTerminal();
 * terminal.onData(data => console.log(data));
 * await terminal.write('ls -la\n');
 *
 * // Cleanup
 * await computer.dispose();
 * ```
 */
export async function createLocalComputer(
  config: ComputerConfig
): Promise<Computer> {
  const computer = new LocalComputer(config);
  await computer.init();
  return computer;
}
