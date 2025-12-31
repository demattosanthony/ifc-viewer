/**
 * @ifc-viewer/core
 *
 * Domain entities, interfaces, and client for the IFC Viewer platform.
 *
 * ## Architecture
 *
 * - **Entities**: Core domain objects (Session, Conversation, FileNode)
 * - **Repositories**: Data access interfaces
 * - **Errors**: Domain-specific error types
 * - **Client**: Unified facade for all operations
 *
 * ## Usage
 *
 * ```typescript
 * import { createClient } from "@ifc-viewer/core";
 *
 * const client = createClient({
 *   sessionRepository: db.sessions,
 *   conversationRepository: db.conversations,
 *   defaultWorkingDirectory: "/tmp/ifc-viewer",
 * });
 *
 * const session = await client.sessions.create();
 * const conversation = await client.conversations.start(session.id);
 * ```
 */

// Entities
export * from "./entities";

// Repositories
export * from "./repositories";

// Errors
export * from "./errors";

// Client
export * from "./client";
