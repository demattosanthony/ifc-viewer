/**
 * @ifc-viewer/core
 *
 * Domain entities, interfaces, and client for the IFC Viewer platform.
 *
 * ## Architecture
 *
 * - **Entities**: Core domain objects (Project, Workspace, Conversation, Message)
 * - **Repositories**: Data access interfaces
 * - **Errors**: Domain-specific error types
 * - **Client**: Unified facade for all operations
 *
 * ## Domain Model
 *
 * Project (persistent) -> Workspace (ephemeral) -> Conversation -> Message
 *
 * - Project: Persistent git repository for BIM files
 * - Workspace: Ephemeral compute environment where projects are loaded
 * - Conversation: AI chat session within a workspace
 * - Message: Individual chat message in a conversation
 */

// Entities
export * from "./entities";

// Repositories
export * from "./repositories";

// Errors
export * from "./errors";

// Client
export * from "./client";
