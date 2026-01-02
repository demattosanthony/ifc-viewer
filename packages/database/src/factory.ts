import { resolve } from "node:path"
import type { Database } from "@ifc-viewer/core"
import {
  createProjectRepository as createMemoryProjectRepository,
  createWorkspaceRepository as createMemoryWorkspaceRepository,
  createConversationRepository as createMemoryConversationRepository,
  createMessageRepository as createMemoryMessageRepository,
} from "./providers/memory"
import {
  createSQLiteConnection,
  runMigrations,
  createProjectRepository as createSqliteProjectRepository,
  createWorkspaceRepository as createSqliteWorkspaceRepository,
  createConversationRepository as createSqliteConversationRepository,
  createMessageRepository as createSqliteMessageRepository,
} from "./providers/sqlite"

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

export type DatabaseConfig = SQLiteDatabaseConfig | MemoryDatabaseConfig

/** Create a database provider */
export async function createDatabase(config: DatabaseConfig): Promise<Database.Provider> {
  if (config.type === "memory") {
    return createMemoryDatabase()
  }
  return createSQLiteDatabase(config)
}

function createMemoryDatabase(): Database.Provider {
  return {
    projects: createMemoryProjectRepository(),
    workspaces: createMemoryWorkspaceRepository(),
    conversations: createMemoryConversationRepository(),
    messages: createMemoryMessageRepository(),
    dispose: async () => {},
  }
}

async function createSQLiteDatabase(config: SQLiteDatabaseConfig): Promise<Database.Provider> {
  const filename = config.filename ?? resolve(config.dataDirectory, "ifc-viewer.db")
  const { db, close } = await createSQLiteConnection({ filename })

  runMigrations(db)

  return {
    projects: createSqliteProjectRepository(db),
    workspaces: createSqliteWorkspaceRepository(db),
    conversations: createSqliteConversationRepository(db),
    messages: createSqliteMessageRepository(db),
    dispose: async () => close(),
  }
}
