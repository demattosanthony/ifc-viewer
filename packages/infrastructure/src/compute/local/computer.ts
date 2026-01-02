import type { Computer, ComputeConfig, FileSystem, Shell, TerminalSession } from "@ifc-viewer/core"
import { mkdir, rm } from "node:fs/promises"
import { LocalFileSystem } from "./filesystem"
import { LocalShell } from "./shell"

export class LocalComputer implements Computer {
  readonly id: string
  readonly workingDirectory: string

  private readonly cleanup: boolean
  private _files: FileSystem
  private _shell: Shell

  private terminals = new Map<string, TerminalSession>()
  private agentTerminal: TerminalSession | null = null

  constructor(config: ComputeConfig) {
    this.id = `computer-${Date.now()}-${Math.random().toString(36).slice(2)}`
    this.workingDirectory = config.workingDirectory
    this.cleanup = config.cleanup ?? false

    this._files = new LocalFileSystem(config.workingDirectory)
    this._shell = new LocalShell(config.workingDirectory, config.environment)
  }

  async init(): Promise<void> {
    await mkdir(this.workingDirectory, { recursive: true })
  }

  get files(): FileSystem {
    return this._files
  }

  get shell(): Shell {
    return this._shell
  }

  async createTerminal(): Promise<TerminalSession> {
    const terminal = await this._shell.startTerminal()
    this.terminals.set(terminal.id, terminal)
    return terminal
  }

  getTerminal(id: string): TerminalSession | undefined {
    return this.terminals.get(id)
  }

  getAllTerminals(): TerminalSession[] {
    return Array.from(this.terminals.values())
  }

  async disposeTerminal(id: string): Promise<void> {
    const terminal = this.terminals.get(id)
    if (!terminal) return

    await terminal.kill()
    this.terminals.delete(id)

    if (this.agentTerminal?.id === id) {
      this.agentTerminal = null
    }
  }

  async getOrCreateAgentTerminal(): Promise<TerminalSession> {
    if (this.agentTerminal) {
      return this.agentTerminal
    }

    const terminal = await this._shell.startTerminal()
    this.terminals.set(terminal.id, terminal)
    this.agentTerminal = terminal
    return terminal
  }

  hasAgentTerminal(): boolean {
    return this.agentTerminal !== null
  }

  async dispose(): Promise<void> {
    const terminalsToKill = Array.from(this.terminals.values())
    await Promise.all(terminalsToKill.map((t) => t.kill()))
    this.terminals.clear()
    this.agentTerminal = null

    if (this.cleanup) {
      await rm(this.workingDirectory, { recursive: true, force: true }).catch(
        () => {}
      )
    }
  }
}

export async function createLocalComputer(
  config: ComputeConfig
): Promise<Computer> {
  const computer = new LocalComputer(config)
  await computer.init()
  return computer
}
