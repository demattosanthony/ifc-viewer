import type { Computer, FileSystem, Shell, TerminalSession } from "@ifc-viewer/core"
import { createLogger } from "@ifc-viewer/logger"
import type { Container } from "dockerode"
import Docker from "dockerode"
import { DockerFileSystem } from "./filesystem"
import { DockerShell } from "./shell"

const log = createLogger("docker")

const DEFAULT_IMAGE = "bim-ide:latest"
const DEFAULT_WORK_DIR = "/workspace"

/** Paths accessible to the filesystem */
const ALLOWED_PATHS = ["/workspace", "/opt/skills"]

/**
 * Docker-specific compute configuration
 */
export interface DockerComputeConfig {
  /** Docker image to use (default: bim-ide:latest) */
  image?: string
  /** Custom container name (auto-generated if not provided) */
  containerName?: string
  /** Memory limit (e.g., "512m", "1g") */
  memory?: string
  /** CPU limit (e.g., 1, 0.5) */
  cpus?: number
  /** Docker socket path (default: /var/run/docker.sock) */
  socketPath?: string
  /** Docker host URL (alternative to socketPath) */
  host?: string
  /** Docker port (used with host) */
  port?: number
  /** Environment variables to set in container */
  environment?: Record<string, string>
}

/**
 * Docker-based Computer implementation
 *
 * Creates and manages a Docker container for sandboxed compute operations.
 * The container is created on init() and removed on dispose().
 */
export class DockerComputer implements Computer {
  readonly id: string
  readonly workingDirectory: string

  private docker: Docker
  private container: Container | null = null

  private readonly config: DockerComputeConfig
  private readonly image: string
  private readonly containerWorkDir: string

  private _files: FileSystem | null = null
  private _shell: Shell | null = null

  private terminals = new Map<string, TerminalSession>()
  private agentTerminal: TerminalSession | null = null
  private agentPythonSession: TerminalSession | null = null

  constructor(config: DockerComputeConfig = {}) {
    this.id = `docker-computer-${Date.now()}-${Math.random().toString(36).slice(2)}`
    this.config = config
    this.image = config.image ?? DEFAULT_IMAGE
    this.containerWorkDir = DEFAULT_WORK_DIR
    // Working directory is the container's internal path (no host mount)
    this.workingDirectory = this.containerWorkDir

    // Initialize Docker client
    const dockerOptions: Docker.DockerOptions = {}
    if (config.socketPath) {
      dockerOptions.socketPath = config.socketPath
    } else if (config.host) {
      dockerOptions.host = config.host
      dockerOptions.port = config.port
    }

    this.docker = new Docker(dockerOptions)
  }

  /**
   * Initialize the Docker computer
   *
   * - Ensures the image exists (or pulls it)
   * - Creates and starts the container
   * - Initializes FileSystem and Shell adapters
   */
  async init(): Promise<void> {
    // Check if image exists, if not attempt to pull
    await this.ensureImage()

    // Generate container name
    const containerName =
      this.config.containerName ?? `bim-ide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Build container options
    // Note: No bind mounts - files live entirely within the container.
    // Files are copied from storage on startup and changes are tracked
    // via ChangeTracker, then persisted back to storage on disposal.
    const createOptions: Docker.ContainerCreateOptions = {
      Image: this.image,
      name: containerName,
      WorkingDir: this.containerWorkDir,
      Tty: true, // Keep container running
      OpenStdin: true,
      Env: this.buildEnvArray(),
      HostConfig: {
        AutoRemove: false, // We'll remove manually on dispose
      },
    }

    // Add resource limits if specified
    if (this.config.memory || this.config.cpus) {
      createOptions.HostConfig = {
        ...createOptions.HostConfig,
      }

      if (this.config.memory) {
        createOptions.HostConfig.Memory = this.parseMemory(this.config.memory)
      }

      if (this.config.cpus) {
        createOptions.HostConfig.NanoCpus = Math.floor(this.config.cpus * 1e9)
      }
    }

    // Create container
    this.container = await this.docker.createContainer(createOptions)

    // Start container
    await this.container.start()

    // Initialize adapters with allowed paths
    this._files = new DockerFileSystem(this.container, ALLOWED_PATHS)
    this._shell = new DockerShell(this.container, this.containerWorkDir, this.config.environment)
  }

  /**
   * Ensure the Docker image exists, pulling if necessary
   */
  private async ensureImage(): Promise<void> {
    try {
      const image = this.docker.getImage(this.image)
      await image.inspect()
    } catch (err: unknown) {
      if (err && typeof err === "object" && "statusCode" in err && err.statusCode === 404) {
        // Image doesn't exist, try to pull
        log.info("Pulling image", { image: this.image })
        await this.pullImage()
      } else {
        throw err
      }
    }
  }

  /**
   * Pull the Docker image
   */
  private async pullImage(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.docker.pull(this.image, {}, (err, stream) => {
        if (err) {
          reject(err)
          return
        }

        if (!stream) {
          reject(new Error(`Failed to pull image ${this.image}: no stream returned`))
          return
        }

        // Follow pull progress
        this.docker.modem.followProgress(
          stream,
          (err) => {
            if (err) {
              reject(err)
            } else {
              log.info("Image pulled successfully", { image: this.image })
              resolve()
            }
          },
          (_event) => {
            // Progress events are noisy, omit logging
          }
        )
      })
    })
  }

  /**
   * Build environment variables array for container
   */
  private buildEnvArray(): string[] {
    const env: string[] = [`TERM=xterm-256color`, `SHELL=/bin/bash`]

    if (this.config.environment) {
      for (const [key, value] of Object.entries(this.config.environment)) {
        env.push(`${key}=${value}`)
      }
    }

    return env
  }

  /**
   * Parse memory string to bytes
   */
  private parseMemory(memory: string): number {
    const match = memory.match(/^(\d+(?:\.\d+)?)\s*(k|m|g|t)?b?$/i)
    if (!match) {
      throw new Error(`Invalid memory format: ${memory}`)
    }

    const value = parseFloat(match[1]!)
    const unit = (match[2] ?? "").toLowerCase()

    const multipliers: Record<string, number> = {
      "": 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
      t: 1024 * 1024 * 1024 * 1024,
    }

    return Math.floor(value * (multipliers[unit] || 1))
  }

  get files(): FileSystem {
    if (!this._files) {
      throw new Error("DockerComputer not initialized. Call init() first.")
    }
    return this._files
  }

  get shell(): Shell {
    if (!this._shell) {
      throw new Error("DockerComputer not initialized. Call init() first.")
    }
    return this._shell
  }

  async createTerminal(): Promise<TerminalSession> {
    const terminal = await this.shell.startTerminal()
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
    if (this.agentPythonSession?.id === id) {
      this.agentPythonSession = null
    }
  }

  async getOrCreateAgentTerminal(): Promise<TerminalSession> {
    if (this.agentTerminal) {
      return this.agentTerminal
    }

    const terminal = await this.shell.startTerminal()
    this.terminals.set(terminal.id, terminal)
    this.agentTerminal = terminal
    return terminal
  }

  hasAgentTerminal(): boolean {
    return this.agentTerminal !== null
  }

  async getOrCreateAgentPythonSession(): Promise<TerminalSession> {
    if (this.agentPythonSession) {
      return this.agentPythonSession
    }

    const session = await this.shell.startPythonTerminal({
      preImports: ["import ifcopenshell"],
    })
    this.terminals.set(session.id, session)
    this.agentPythonSession = session
    return session
  }

  hasAgentPythonSession(): boolean {
    return this.agentPythonSession !== null
  }

  /**
   * Dispose the Docker computer
   *
   * - Kills all terminal sessions
   * - Stops and removes the container
   */
  async dispose(): Promise<void> {
    // Kill all terminals
    const terminalsToKill = Array.from(this.terminals.values())
    await Promise.all(terminalsToKill.map((t) => t.kill().catch(() => {})))
    this.terminals.clear()
    this.agentTerminal = null
    this.agentPythonSession = null

    // Stop and remove container
    if (this.container) {
      try {
        await this.container.stop({ t: 2 }).catch(() => {})
      } catch {
        // Container might already be stopped
      }

      try {
        await this.container.remove({ force: true })
      } catch {
        // Container might already be removed
      }

      this.container = null
    }

    this._files = null
    this._shell = null
  }
}

/**
 * Factory function to create a DockerComputer
 */
export async function createDockerComputer(config: DockerComputeConfig): Promise<Computer> {
  const computer = new DockerComputer(config)
  await computer.init()
  return computer
}
