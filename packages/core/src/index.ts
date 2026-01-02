/**
 * @ifc-viewer/core
 *
 * Core domain logic for the IFC Viewer platform.
 *
 * ## Architecture
 *
 * - schema/     - Zod schemas (types + runtime validation)
 * - domain/     - Pure transformation functions (no I/O)
 * - ops/        - Operation contracts (database, storage, compute)
 * - use-cases/  - Application logic (combines domain + ops)
 * - context     - Dependency injection
 * - errors/     - Typed error definitions
 *
 * ## Domain Model
 *
 * Project (persistent) -> Workspace (ephemeral) -> Conversation -> Message
 */

// Schema - Zod schemas as source of truth
export * from "./schema"

// Domain - Pure transformation functions
export * from "./domain"

// Operations - Side-effect contracts
export * from "./ops"

// Use Cases - Application logic
export * as useCases from "./use-cases"

// Context - Dependency injection
export * from "./context"

// Errors - Typed error definitions
export * from "./errors"
