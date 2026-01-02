/**
 * @ifc-viewer/core
 *
 * Core domain logic for the IFC Viewer platform.
 *
 * ## Architecture
 *
 * - domain/     - Business entities (schemas, types, use cases)
 * - contracts/  - Infrastructure contracts (database, storage, compute)
 * - context     - Dependency injection
 * - errors      - Domain error types
 *
 * ## Domain Model
 *
 * Project (persistent) -> Workspace (ephemeral) -> Conversation -> Message
 */

// Domain - Business entities
export { Project, Workspace, Conversation, Message } from "./domain"

// Contracts - Infrastructure interfaces
export type { Database, Storage, Compute } from "./contracts"

// Context - Dependency injection
export * from "./context"

// Errors - Domain error types
export * from "./errors"
