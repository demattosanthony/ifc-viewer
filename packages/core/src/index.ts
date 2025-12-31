/**
 * @ifc-viewer/core
 *
 * Domain entities, repository interfaces, and errors for the IFC Viewer platform.
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

export * from "./entities";
export * from "./repositories";
export * from "./errors";
