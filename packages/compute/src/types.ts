export interface ComputerProvider {
  readonly id: string;
  readonly name: string;
  create(config?: ComputerConfig): Promise<Computer>;
}

export interface Computer {
  readonly id: string;

  files: FileSystem;
  shell: Shell;

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
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout?: number;
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

// Result types
export type ComputerStatus =
  | "initializing"
  | "ready"
  | "busy"
  | "error"
  | "disposed";
