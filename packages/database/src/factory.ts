import type { SessionRepository, SessionRepositoryEvents } from "@ifc-viewer/core";
import {
  MemorySessionRepository,
  type MemorySessionRepositoryConfig,
} from "./providers/memory";

/**
 * Database provider that contains all repository implementations
 */
export interface DatabaseProvider {
  /** Session repository for session management */
  sessions: SessionRepository;
  /** Dispose all resources and clean up */
  dispose(): Promise<void>;
}

/**
 * Configuration for memory database
 */
export interface MemoryDatabaseConfig {
  type: "memory";
  /** Working directory for file operations */
  workingDirectory: string;
  /** Default TTL for sessions in milliseconds */
  defaultTtlMs?: number;
  /** Event handlers for session lifecycle */
  events?: SessionRepositoryEvents;
}

// Future database types can be added here
// export interface PostgresDatabaseConfig {
//   type: 'postgres';
//   connectionString: string;
// }

/**
 * Union of all database configuration types
 */
export type DatabaseConfig = MemoryDatabaseConfig;
// | PostgresDatabaseConfig;

/**
 * Create a database provider based on configuration
 *
 * @example
 * ```ts
 * const db = createDatabase({
 *   type: 'memory',
 *   workingDirectory: '/tmp/ifc-viewer',
 *   events: {
 *     onSessionExpired: async (id) => {
 *       console.log(`Session ${id} expired`);
 *     }
 *   }
 * });
 *
 * const session = await db.sessions.create({});
 * ```
 */
export function createDatabase(config: DatabaseConfig): DatabaseProvider {
  // Currently only memory provider is supported
  // When adding new providers, update DatabaseConfig union type
  if (config.type !== "memory") {
    throw new Error(`Unknown database type: ${config.type}`);
  }

  const sessionConfig: MemorySessionRepositoryConfig = {
    defaultWorkingDirectory: config.workingDirectory,
    defaultTtlMs: config.defaultTtlMs,
    events: config.events,
  };

  const sessions = new MemorySessionRepository(sessionConfig);

  return {
    sessions,
    dispose: async () => {
      await sessions.disposeAll();
    },
  };
}
