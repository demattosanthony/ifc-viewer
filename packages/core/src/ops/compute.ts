/**
 * Compute Operations Contract
 *
 * Defines the interface for compute sandbox operations.
 * Implementations: local (Bun), Docker, cloud sandboxes
 */

/** Terminal session for interactive shell */
export type TerminalSession = {
  readonly id: string
  write(data: string): Promise<void>
  resize(cols: number, rows: number): void
  kill(signal?: number): Promise<void>
  onData(callback: (data: string) => void): () => void
  onExit(callback: (code: number) => void): () => void
}

/** Terminal options */
export type TerminalOptions = {
  cwd?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

/** File entry from directory listing */
export type FileEntry = {
  name: string
  path: string
  type: "file" | "directory" | "symlink"
  size: number
  modifiedAt: number
}

/** File stat info */
export type FileStat = {
  type: "file" | "directory" | "symlink"
  size: number
  createdAt: number
  modifiedAt: number
  accessedAt: number
}

/** Read options */
export type ReadOptions = {
  encoding?: "utf-8" | "binary"
}

/** File content result */
export type FileContent =
  | { type: "text"; content: string }
  | { type: "binary"; content: Uint8Array }

/** File system operations */
export type FileSystemOps = {
  read(path: string, options?: ReadOptions): Promise<FileContent>
  write(path: string, content: string | Uint8Array): Promise<void>
  list(path: string): Promise<FileEntry[]>
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  delete(path: string, options?: { recursive?: boolean }): Promise<void>
  stat(path: string): Promise<FileStat>
  copy(src: string, dest: string): Promise<void>
  move(src: string, dest: string): Promise<void>
}

/** Shell operations */
export type ShellOps = {
  startTerminal(options?: TerminalOptions): Promise<TerminalSession>
}

/** Compute configuration */
export type ComputeConfig = {
  workingDirectory: string
  environment?: Record<string, string>
  cleanup?: boolean
}

/** Computer operations - the main compute sandbox interface */
export type ComputeOps = {
  readonly id: string
  readonly workingDirectory: string
  files: FileSystemOps
  shell: ShellOps
  createTerminal(): Promise<TerminalSession>
  getTerminal(id: string): TerminalSession | undefined
  getAllTerminals(): TerminalSession[]
  disposeTerminal(id: string): Promise<void>
  getOrCreateAgentTerminal(): Promise<TerminalSession>
  hasAgentTerminal(): boolean
  dispose(): Promise<void>
}
