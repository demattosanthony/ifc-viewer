/**
 * Compute Adapters
 *
 * Provides compute environment implementations (local and Docker).
 */

// Re-export compute types from core
export type { Computer, ComputeConfig, FileSystem, Shell, TerminalSession, TerminalOptions } from "@ifc-viewer/core"

// Local provider
export * from "./local"

// Docker provider
export * from "./docker"
