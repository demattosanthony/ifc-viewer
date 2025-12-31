import { resolve } from "node:path";
import type {
  ProjectRepository,
  WorkspaceRepository,
  ConversationRepository,
  MessageRepository,
} from "@ifc-viewer/core";
import {
  createMemoryProjectRepository,
  createMemoryWorkspaceRepository,
  createMemoryConversationRepository,
  createMemoryMessageRepository,
} from "./providers/memory";
import {
  createSQLiteConnection,
  runMigrations,
  createSqliteProjectRepository,
  createSqliteWorkspaceRepository,
  createSqliteConversationRepository,
  createSqliteMessageRepository,
} from "./providers/sqlite";

/**
 * Database provider that contains all repository implementations
 */
export interface DatabaseProvider {
  projects: ProjectRepository;
  workspaces: WorkspaceRepository;
  conversations: ConversationRepository;
  messages: MessageRepository;
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
}

/**
 * Configuration for in-memory database
 */
export interface MemoryDatabaseConfig {
  type: "memory";
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
 * });
 *
 * // In-memory
 * const db = await createDatabase({
 *   type: 'memory',
 * });
 * ```
 */
export async function createDatabase(
  config: DatabaseConfig
): Promise<DatabaseProvider> {
  if (config.type === "memory") {
    return createMemoryDatabase();
  }

  return createSQLiteDatabase(config);
}

function createMemoryDatabase(): DatabaseProvider {
  const projects = createMemoryProjectRepository();
  const workspaces = createMemoryWorkspaceRepository();
  const conversations = createMemoryConversationRepository();
  const messages = createMemoryMessageRepository();

  return {
    projects,
    workspaces,
    conversations,
    messages,
    dispose: async () => {
      // Memory repos don't need cleanup
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

  const projects = createSqliteProjectRepository(db);
  const workspaces = createSqliteWorkspaceRepository(db);
  const conversations = createSqliteConversationRepository(db);
  const messages = createSqliteMessageRepository(db);

  return {
    projects,
    workspaces,
    conversations,
    messages,
    dispose: async () => {
      close();
    },
  };
}
