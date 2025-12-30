import type { StorageProvider } from "@ifc-viewer/storage";
import { LocalStorageProvider } from "@ifc-viewer/storage";
import type { Sandbox, SandboxConfig } from "../../sandbox";
import type { Computer, TerminalSession } from "../../types";
import { LocalComputer } from "./computer";

/**
 * Local sandbox implementation using LocalComputer and LocalStorageProvider
 */
export class LocalSandbox implements Sandbox {
  readonly id: string;
  readonly workingDirectory: string;
  readonly computer: Computer;
  readonly storage: StorageProvider;

  private terminals = new Map<string, TerminalSession>();
  private agentTerminal: TerminalSession | null = null;

  constructor(
    id: string,
    computer: LocalComputer,
    storage: StorageProvider,
    workingDirectory: string
  ) {
    this.id = id;
    this.computer = computer;
    this.storage = storage;
    this.workingDirectory = workingDirectory;
  }

  async createTerminal(): Promise<TerminalSession> {
    const terminal = await this.computer.shell.startTerminal();
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

    const terminal = await this.computer.shell.startTerminal();
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

    // Dispose storage if it has a dispose method
    await this.storage.dispose?.();

    // Dispose computer
    await this.computer.dispose();
  }
}

/**
 * Create a local sandbox
 */
export async function createLocalSandbox(
  config: SandboxConfig
): Promise<LocalSandbox> {
  const id = `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;

  // Create the computer
  const computer = new LocalComputer(config.workingDirectory, {
    environment: config.environment,
  });
  await computer.init();

  // Create storage provider
  const storage = new LocalStorageProvider({
    baseDir: config.workingDirectory,
    urlMode: config.storageUrlMode ?? "data",
  });

  return new LocalSandbox(id, computer, storage, config.workingDirectory);
}
