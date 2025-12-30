/**
 * Core Computer interface - provides file system and shell capabilities
 */
export interface Computer {
  readonly id: string;
  readonly workingDirectory: string;

  /** File system operations */
  files: FileSystem;

  /** Shell for terminal sessions */
  shell: Shell;

  /**
   * Create a new terminal session
   */
  createTerminal(): Promise<TerminalSession>;

  /**
   * Get an existing terminal by ID
   */
  getTerminal(id: string): TerminalSession | undefined;

  /**
   * Get all active terminals
   */
  getAllTerminals(): TerminalSession[];

  /**
   * Dispose a terminal by ID
   */
  disposeTerminal(id: string): Promise<void>;

  /**
   * Get or create the dedicated agent terminal
   * This terminal persists for the lifetime of the computer
   */
  getOrCreateAgentTerminal(): Promise<TerminalSession>;

  /**
   * Check if the computer has an agent terminal
   */
  hasAgentTerminal(): boolean;

  /**
   * Dispose the computer and all its resources
   */
  dispose(): Promise<void>;
}

export interface FileSystem {
  read(path: string, options?: ReadOptions): Promise<FileContent>;
  write(path: string, content: string | Uint8Array): Promise<void>;
  list(path: string): Promise<FileEntry[]>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  delete(path: string, options?: { recursive?: boolean }): Promise<void>;
  stat(path: string): Promise<FileStat>;
  copy(src: string, dest: string): Promise<void>;
  move(src: string, dest: string): Promise<void>;
}

export interface Shell {
  startTerminal(options?: TerminalOptions): Promise<TerminalSession>;
}

// Supporting types

export interface TerminalSession {
  readonly id: string;
  write(data: string): Promise<void>;
  resize(cols: number, rows: number): void;
  kill(signal?: number): Promise<void>;
  onData(callback: (data: string) => void): () => void;
  onExit(callback: (code: number) => void): () => void;
}

export interface ComputerConfig {
  workingDirectory: string;
  environment?: Record<string, string>;
  /** Whether to cleanup the workspace on dispose */
  cleanup?: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size: number;
  modifiedAt: number;
}

export interface FileStat {
  type: "file" | "directory" | "symlink";
  size: number;
  createdAt: number;
  modifiedAt: number;
  accessedAt: number;
}

export interface ReadOptions {
  encoding?: "utf-8" | "binary";
}

export interface TerminalOptions {
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export type FileContent =
  | { type: "text"; content: string }
  | { type: "binary"; content: Uint8Array };
