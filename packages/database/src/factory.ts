import { resolve } from "node:path";
import type {
  SessionRepository,
  SessionRepositoryEvents,
  ConversationRepository,
} from "@ifc-viewer/core";
import {
  MemorySessionRepository,
  MemoryConversationRepository,
  type MemorySessionRepositoryConfig,
} from "./providers/memory";
import {
  createSQLiteConnection,
  runMigrations,
  SQLiteSessionRepository,
  SQLiteConversationRepository,
} from "./providers/sqlite";

/**
 * Database provider that contains all repository implementations
 */
export interface DatabaseProvider {
  sessions: SessionRepository;
  conversations: ConversationRepository;
  dispose(): Promise<void>;
}

/**
 * Configuration for SQLite database (default)
 */
export interface SQLiteDatabaseConfig {
  type?: "sqlite";
  /** Database file path. Defaults to ./data/ifc-viewer.db relative to dataDirectory */
  filename?: string;
  /** Directory for application data (database files). Required. */
  dataDirectory: string;
  /** Default working directory for sessions (sandbox workspace) */
  defaultWorkingDirectory: string;
  /** Default TTL for sessions in milliseconds */
  defaultTtlMs?: number;
  /** Event handlers for session lifecycle */
  events?: SessionRepositoryEvents;
}

/**
 * Configuration for in-memory database
 */
export interface MemoryDatabaseConfig {
  type: "memory";
  /** Default working directory for sessions (sandbox workspace) */
  defaultWorkingDirectory: string;
  /** Default TTL for sessions in milliseconds */
  defaultTtlMs?: number;
  /** Event handlers for session lifecycle */
  events?: SessionRepositoryEvents;
}

export type DatabaseConfig = SQLiteDatabaseConfig | MemoryDatabaseConfig;

/**
 * Create a database provider based on configuration
 * SQLite is the default if no type is specified
 *
 * @example
 * ```ts
 * // SQLite (default)
 * const db = await createDatabase({
 *   dataDirectory: './data',
 *   defaultWorkingDirectory: './workspace',
 * });
 *
 * // In-memory
 * const db = await createDatabase({
 *   type: 'memory',
 *   defaultWorkingDirectory: './workspace',
 * });
 * ```
 */
export async function createDatabase(
  config: DatabaseConfig
): Promise<DatabaseProvider> {
  if (config.type === "memory") {
    return createMemoryDatabase(config);
  }

  return createSQLiteDatabase(config);
}

function createMemoryDatabase(config: MemoryDatabaseConfig): DatabaseProvider {
  const sessionConfig: MemorySessionRepositoryConfig = {
    defaultWorkingDirectory: config.defaultWorkingDirectory,
    defaultTtlMs: config.defaultTtlMs,
    events: config.events,
  };

  const sessions = new MemorySessionRepository(sessionConfig);
  const conversations = new MemoryConversationRepository();

  return {
    sessions,
    conversations,
    dispose: async () => {
      await sessions.disposeAll();
      await conversations.disposeAll();
    },
  };
}

async function createSQLiteDatabase(
  config: SQLiteDatabaseConfig
): Promise<DatabaseProvider> {
  const filename =
    config.filename ?? resolve(config.dataDirectory, "ifc-viewer.db");

  const { db, close } = await createSQLiteConnection({ filename });

  // Run migrations on startup
  runMigrations(db);

  const sessions = new SQLiteSessionRepository({
    db,
    defaultWorkingDirectory: config.defaultWorkingDirectory,
    defaultTtlMs: config.defaultTtlMs,
    events: config.events,
  });

  // Initialize expiry timers for existing sessions
  await sessions.initializeExpiryTimers();

  const conversations = new SQLiteConversationRepository({ db });

  return {
    sessions,
    conversations,
    dispose: async () => {
      await sessions.disposeAll();
      await conversations.disposeAll();
      close();
    },
  };
}
