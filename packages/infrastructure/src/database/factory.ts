import { resolve } from "node:path"
import type { Database } from "@ifc-viewer/core"
import {
  createProjectRepository as createMemoryProjectRepository,
  createWorkspaceRepository as createMemoryWorkspaceRepository,
  createConversationRepository as createMemoryConversationRepository,
  createMessageRepository as createMemoryMessageRepository,
} from "./memory"
import {
  createSQLiteConnection,
  runMigrations as runSqliteMigrations,
  createProjectRepository as createSqliteProjectRepository,
  createWorkspaceRepository as createSqliteWorkspaceRepository,
  createConversationRepository as createSqliteConversationRepository,
  createMessageRepository as createSqliteMessageRepository,
} from "./sqlite"
import {
  createPostgresConnection,
  runMigrations as runPostgresMigrations,
  createProjectRepository as createPostgresProjectRepository,
  createWorkspaceRepository as createPostgresWorkspaceRepository,
  createConversationRepository as createPostgresConversationRepository,
  createMessageRepository as createPostgresMessageRepository,
} from "./postgres"

/** Configuration for SQLite database (default) */
export type SQLiteDatabaseConfig = {
  type?: "sqlite"
  filename?: string
  dataDirectory: string
}

/** Configuration for in-memory database */
export type MemoryDatabaseConfig = {
  type: "memory"
}

/** Configuration for Postgres database */
export type PostgresDatabaseConfig = {
  type: "postgres"
  connectionString: string
}

export type DatabaseConfig = SQLiteDatabaseConfig | MemoryDatabaseConfig | PostgresDatabaseConfig

/** Create a database provider */
export async function createDatabase(config: DatabaseConfig): Promise<Database> {
  if (config.type === "memory") {
    return createMemoryDatabase()
  }
  if (config.type === "postgres") {
    return createPostgresDatabase(config)
  }
  return createSQLiteDatabase(config)
}

function createMemoryDatabase(): Database {
  return {
    projects: createMemoryProjectRepository(),
    workspaces: createMemoryWorkspaceRepository(),
    conversations: createMemoryConversationRepository(),
    messages: createMemoryMessageRepository(),
    dispose: async () => {},
  }
}

async function createSQLiteDatabase(config: SQLiteDatabaseConfig): Promise<Database> {
  const filename = config.filename ?? resolve(config.dataDirectory, "ifc-viewer.db")
  const { db, close } = await createSQLiteConnection({ filename })

  runSqliteMigrations(db)

  return {
    projects: createSqliteProjectRepository(db),
    workspaces: createSqliteWorkspaceRepository(db),
    conversations: createSqliteConversationRepository(db),
    messages: createSqliteMessageRepository(db),
    dispose: async () => close(),
  }
}

async function createPostgresDatabase(config: PostgresDatabaseConfig): Promise<Database> {
  const { db, close } = createPostgresConnection({ connectionString: config.connectionString })

  await runPostgresMigrations(db)

  return {
    projects: createPostgresProjectRepository(db),
    workspaces: createPostgresWorkspaceRepository(db),
    conversations: createPostgresConversationRepository(db),
    messages: createPostgresMessageRepository(db),
    dispose: async () => close(),
  }
}
