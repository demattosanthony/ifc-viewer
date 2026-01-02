import { resolve } from "node:path"
import type { DatabaseOps } from "@ifc-viewer/core"
import {
  createMemoryProjectOps,
  createMemoryWorkspaceOps,
  createMemoryConversationOps,
  createMemoryMessageOps,
} from "./providers/memory"
import {
  createSQLiteConnection,
  runMigrations,
  createSqliteProjectOps,
  createSqliteWorkspaceOps,
  createSqliteConversationOps,
  createSqliteMessageOps,
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

/** Create a database operations provider */
export async function createDatabase(config: DatabaseConfig): Promise<DatabaseOps> {
  if (config.type === "memory") {
    return createMemoryDatabase()
  }
  return createSQLiteDatabase(config)
}

function createMemoryDatabase(): DatabaseOps {
  return {
    projects: createMemoryProjectOps(),
    workspaces: createMemoryWorkspaceOps(),
    conversations: createMemoryConversationOps(),
    messages: createMemoryMessageOps(),
    dispose: async () => {},
  }
}

async function createSQLiteDatabase(config: SQLiteDatabaseConfig): Promise<DatabaseOps> {
  const filename = config.filename ?? resolve(config.dataDirectory, "ifc-viewer.db")
  const { db, close } = await createSQLiteConnection({ filename })

  runMigrations(db)

  return {
    projects: createSqliteProjectOps(db),
    workspaces: createSqliteWorkspaceOps(db),
    conversations: createSqliteConversationOps(db),
    messages: createSqliteMessageOps(db),
    dispose: async () => close(),
  }
}
