import type { StorageProvider } from "@ifc-viewer/storage";
import type { Computer, TerminalSession } from "./types";

/**
 * A Sandbox provides an isolated execution environment with:
 * - Computer capabilities (filesystem, shell)
 * - Storage for file serving (URLs, streaming)
 * - Terminal management with dedicated agent terminal
 */
export interface Sandbox {
  /** Unique identifier for this sandbox */
  readonly id: string;

  /** Working directory for file operations */
  readonly workingDirectory: string;

  /** Computer capabilities (filesystem, shell) */
  readonly computer: Computer;

  /** Storage provider for file serving and URLs */
  readonly storage: StorageProvider;

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
   * This terminal persists for the lifetime of the sandbox
   */
  getOrCreateAgentTerminal(): Promise<TerminalSession>;

  /**
   * Check if the sandbox has an agent terminal
   */
  hasAgentTerminal(): boolean;

  /**
   * Dispose the sandbox and all its resources
   */
  dispose(): Promise<void>;
}

/**
 * Configuration for creating a sandbox
 */
export interface SandboxConfig {
  /** Working directory for file operations */
  workingDirectory: string;
  /** Environment variables for processes */
  environment?: Record<string, string>;
  /**
   * URL mode for storage provider:
   * - 'none': No URLs (default)
   * - 'data': Data URLs (base64 encoded, works everywhere)
   */
  storageUrlMode?: "none" | "data";
}

/**
 * Provider for creating sandboxes
 */
export interface SandboxProvider {
  /** Unique identifier for this provider type */
  readonly type: string;
  /** Human-readable name */
  readonly name: string;
  /** Create a new sandbox */
  create(config: SandboxConfig): Promise<Sandbox>;
}
