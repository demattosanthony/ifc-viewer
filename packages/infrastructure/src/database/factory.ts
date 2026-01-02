import { resolve } from "node:path"
import type { Database, UnitOfWork } from "@ifc-viewer/core"
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
  type DrizzleDB as SqliteDrizzleDB,
} from "./sqlite"
import {
  createPostgresConnection,
  runMigrations as runPostgresMigrations,
  createProjectRepository as createPostgresProjectRepository,
  createWorkspaceRepository as createPostgresWorkspaceRepository,
  createConversationRepository as createPostgresConversationRepository,
  createMessageRepository as createPostgresMessageRepository,
  type DrizzleDB as PostgresDrizzleDB,
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
  const projects = createMemoryProjectRepository()
  const workspaces = createMemoryWorkspaceRepository()
  const conversations = createMemoryConversationRepository()
  const messages = createMemoryMessageRepository()

  return {
    projects,
    workspaces,
    conversations,
    messages,
    async transaction<T>(fn: (uow: UnitOfWork) => Promise<T>): Promise<T> {
      // Memory adapter: pass-through (no real transaction needed)
      // The same repositories are used since Map operations are synchronous
      return fn({ projects, workspaces, conversations, messages })
    },
    dispose: async () => {},
  }
}

async function createSQLiteDatabase(config: SQLiteDatabaseConfig): Promise<Database> {
  const filename = config.filename ?? resolve(config.dataDirectory, "ifc-viewer.db")
  const { db, close } = await createSQLiteConnection({ filename })

  runSqliteMigrations(db)

  /** Create repositories for a given db/transaction instance */
  const createRepositories = (dbOrTx: SqliteDrizzleDB): UnitOfWork => ({
    projects: createSqliteProjectRepository(dbOrTx),
    workspaces: createSqliteWorkspaceRepository(dbOrTx),
    conversations: createSqliteConversationRepository(dbOrTx),
    messages: createSqliteMessageRepository(dbOrTx),
  })

  const repos = createRepositories(db)

  return {
    ...repos,
    async transaction<T>(fn: (uow: UnitOfWork) => Promise<T>): Promise<T> {
      // Use Drizzle's transaction which wraps in BEGIN/COMMIT/ROLLBACK
      return db.transaction(async (tx) => {
        const txRepos = createRepositories(tx as unknown as SqliteDrizzleDB)
        return fn(txRepos)
      })
    },
    dispose: async () => close(),
  }
}

async function createPostgresDatabase(config: PostgresDatabaseConfig): Promise<Database> {
  const { db, close } = createPostgresConnection({ connectionString: config.connectionString })

  await runPostgresMigrations(db)

  /** Create repositories for a given db/transaction instance */
  const createRepositories = (dbOrTx: PostgresDrizzleDB): UnitOfWork => ({
    projects: createPostgresProjectRepository(dbOrTx),
    workspaces: createPostgresWorkspaceRepository(dbOrTx),
    conversations: createPostgresConversationRepository(dbOrTx),
    messages: createPostgresMessageRepository(dbOrTx),
  })

  const repos = createRepositories(db)

  return {
    ...repos,
    async transaction<T>(fn: (uow: UnitOfWork) => Promise<T>): Promise<T> {
      // Use Drizzle's transaction which wraps in BEGIN/COMMIT/ROLLBACK
      return db.transaction(async (tx) => {
        const txRepos = createRepositories(tx as unknown as PostgresDrizzleDB)
        return fn(txRepos)
      })
    },
    dispose: async () => close(),
  }
}
