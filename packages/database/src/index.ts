/**
 * @ifc-viewer/database
 *
 * Database implementations for the IFC Viewer platform.
 * Provides SQLite (default) and memory-based implementations.
 *
 * @example
 * ```ts
 * import { createDatabase } from '@ifc-viewer/database';
 *
 * // SQLite (default, persistent)
 * const db = await createDatabase({
 *   dataDirectory: './data',
 * });
 *
 * // Or in-memory (ephemeral)
 * const db = await createDatabase({
 *   type: 'memory',
 * });
 *
 * // Create a project
 * const project = await db.projects.create({ id: 'my-project' });
 *
 * // Create a workspace
 * const workspace = await db.workspaces.create({ projectId: project.id });
 *
 * // Clean up
 * await db.dispose();
 * ```
 */

export { createDatabase, type DatabaseConfig, type SQLiteDatabaseConfig, type MemoryDatabaseConfig } from "./factory";
