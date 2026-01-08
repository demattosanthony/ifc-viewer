import { resolve } from "node:path"
import type { Database, UnitOfWork } from "@ifc-viewer/core"
import {
  createProjectRepository as createMemoryProjectRepository,
  createConversationRepository as createMemoryConversationRepository,
  createMessageRepository as createMemoryMessageRepository,
  createModelRepository as createMemoryModelRepository,
} from "./memory"
import {
  createSQLiteConnection,
  runMigrations as runSqliteMigrations,
  createProjectRepository as createSqliteProjectRepository,
  createConversationRepository as createSqliteConversationRepository,
  createMessageRepository as createSqliteMessageRepository,
  createModelRepository as createSqliteModelRepository,
  type DrizzleDB as SqliteDrizzleDB,
} from "./sqlite"
import {
  createPostgresConnection,
  runMigrations as runPostgresMigrations,
  createProjectRepository as createPostgresProjectRepository,
  createConversationRepository as createPostgresConversationRepository,
  createMessageRepository as createPostgresMessageRepository,
  createModelRepository as createPostgresModelRepository,
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
  const conversations = createMemoryConversationRepository()
  const messages = createMemoryMessageRepository()
  const models = createMemoryModelRepository()

  return {
    projects,
    conversations,
    messages,
    models,
    async transaction<T>(fn: (uow: UnitOfWork) => Promise<T>): Promise<T> {
      // Memory adapter: pass-through (no real transaction needed)
      // The same repositories are used since Map operations are synchronous
      return fn({ projects, conversations, messages, models })
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
    conversations: createSqliteConversationRepository(dbOrTx),
    messages: createSqliteMessageRepository(dbOrTx),
    models: createSqliteModelRepository(dbOrTx),
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
    conversations: createPostgresConversationRepository(dbOrTx),
    messages: createPostgresMessageRepository(dbOrTx),
    models: createPostgresModelRepository(dbOrTx),
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
