/**
 * @ifc-viewer/database
 *
 * Database implementations for the IFC Viewer platform.
 * Currently provides a memory-based implementation suitable for
 * development and single-instance deployments.
 *
 * @example
 * ```ts
 * import { createDatabase } from '@ifc-viewer/database';
 *
 * const db = createDatabase({
 *   type: 'memory',
 *   workingDirectory: '/tmp/ifc-viewer',
 * });
 *
 * // Create a session
 * const session = await db.sessions.create({});
 *
 * // Clean up
 * await db.dispose();
 * ```
 */

export * from "./factory";
export * from "./providers/memory";
