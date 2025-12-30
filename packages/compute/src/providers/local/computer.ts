import type {
  Computer,
  ComputerConfig,
  ComputerStatus,
  FileSystem,
  Shell,
} from "../../types";
import { mkdir, rm } from "node:fs/promises";
import { LocalFileSystem } from "./filesystem";
import { LocalShell } from "./shell";

export interface LocalComputerOptions {
  cleanup?: boolean;
}

export class LocalComputer implements Computer {
  readonly id: string;
  readonly provider = "local";

  private status: ComputerStatus = "initializing";

  private readonly createdAt: number;
  private readonly workDir: string;
  private readonly cleanup: boolean;

  private _files: FileSystem;
  private _shell: Shell;

  constructor(
    workDir: string,
    config?: ComputerConfig,
    options?: LocalComputerOptions
  ) {
    this.id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.createdAt = Date.now();
    this.workDir = workDir;
    this.cleanup = options?.cleanup ?? false;

    const env = config?.environment;

    this._files = new LocalFileSystem(workDir);
    this._shell = new LocalShell(workDir, env);
  }

  /**
   * Initialize the computer (create working directory)
   */
  async init(): Promise<void> {
    // Create working directory directly - don't go through filesystem
    // to avoid path resolution issues
    await mkdir(this.workDir, { recursive: true });
    this.status = "ready";
  }

  get files(): FileSystem {
    return this._files;
  }

  get shell(): Shell {
    return this._shell;
  }

  get workingDirectory(): string {
    return this.workDir;
  }

  async dispose(): Promise<void> {
    if (this.cleanup) {
      await rm(this.workDir, { recursive: true, force: true }).catch(() => {});
    }
    this.status = "disposed";
  }
}
