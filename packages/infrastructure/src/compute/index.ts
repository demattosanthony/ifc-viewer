/**
 * Compute Adapters
 *
 * Provides compute environment implementations (local and Docker).
 */

// Re-export compute types from core
export type {
  ComputeConfig,
  Computer,
  FileSystem,
  Shell,
  TerminalOptions,
  TerminalSession,
} from "@ifc-viewer/core"
// Docker provider
export * from "./docker"
// Local provider
export * from "./local"
