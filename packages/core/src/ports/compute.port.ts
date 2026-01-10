/**
 * Compute Port
 *
 * Defines the interface for compute sandbox operations.
 * Implementations: local (Bun), Docker, cloud sandboxes
 */

// ============================================================================
// Terminal Types
// ============================================================================

/** Terminal session for interactive shell */
export interface TerminalSession {
  readonly id: string
  write(data: string): Promise<void>
  resize(cols: number, rows: number): void
  kill(signal?: number): Promise<void>
  onData(callback: (data: string) => void): () => void
  onExit(callback: (code: number) => void): () => void
}

/** Terminal options */
export interface TerminalOptions {
  cwd?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

/** Python terminal options */
export interface PythonTerminalOptions extends TerminalOptions {
  /** Pre-import statements to execute on session start */
  preImports?: string[]
}

// ============================================================================
// File System Types
// ============================================================================

/** File entry from directory listing */
export interface FileEntry {
  name: string
  path: string
  type: "file" | "directory" | "symlink"
  size: number
  modifiedAt: number
}

/** File stat info */
export interface FileStat {
  type: "file" | "directory" | "symlink"
  size: number
  createdAt: number
  modifiedAt: number
  accessedAt: number
}

/** Read options */
export interface FileReadOptions {
  encoding?: "utf-8" | "binary"
}

/** File content result */
export type FileContent =
  | { type: "text"; content: string }
  | { type: "binary"; content: Uint8Array }

/** File system interface */
export interface FileSystem {
  read(path: string, options?: FileReadOptions): Promise<FileContent>
  write(path: string, content: string | Uint8Array): Promise<void>
  list(path: string): Promise<FileEntry[]>
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  delete(path: string, options?: { recursive?: boolean }): Promise<void>
  stat(path: string): Promise<FileStat>
  copy(src: string, dest: string): Promise<void>
  move(src: string, dest: string): Promise<void>
}

/** Shell interface */
export interface Shell {
  startTerminal(options?: TerminalOptions): Promise<TerminalSession>
  startPythonTerminal(options?: PythonTerminalOptions): Promise<TerminalSession>
}

// ============================================================================
// Compute Provider
// ============================================================================

/** Compute configuration */
export interface ComputeConfig {
  workingDirectory: string
  environment?: Record<string, string>
  cleanup?: boolean
}

/** Compute provider interface */
export interface Computer {
  readonly id: string
  readonly workingDirectory: string
  files: FileSystem
  shell: Shell
  createTerminal(): Promise<TerminalSession>
  getTerminal(id: string): TerminalSession | undefined
  getAllTerminals(): TerminalSession[]
  disposeTerminal(id: string): Promise<void>
  getOrCreateAgentTerminal(): Promise<TerminalSession>
  hasAgentTerminal(): boolean
  getOrCreateAgentPythonSession(): Promise<TerminalSession>
  hasAgentPythonSession(): boolean
  dispose(): Promise<void>
}
