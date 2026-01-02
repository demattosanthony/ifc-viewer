/**
 * Compute Adapters
 *
 * Provides local compute environment implementations.
 */

// Re-export compute types from core
export type { Computer, ComputeConfig, FileSystem, Shell, TerminalSession, TerminalOptions } from "@ifc-viewer/core"

// Local provider
export * from "./local"
