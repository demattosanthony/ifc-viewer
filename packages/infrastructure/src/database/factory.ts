import { resolve } from "node:path"
import type { Database, UnitOfWork } from "@ifc-viewer/core"
import {
  createConversationRepository as createMemoryConversationRepository,
  createMessagePartRepository as createMemoryMessagePartRepository,
  createMessageRepository as createMemoryMessageRepository,
  createModelRepository as createMemoryModelRepository,
  createProjectRepository as createMemoryProjectRepository,
} from "./memory"
import {
  createPostgresConnection,
  createConversationRepository as createPostgresConversationRepository,
  createMessagePartRepository as createPostgresMessagePartRepository,
  createMessageRepository as createPostgresMessageRepository,
  createModelRepository as createPostgresModelRepository,
  createProjectRepository as createPostgresProjectRepository,
  type DrizzleDB as PostgresDrizzleDB,
  runMigrations as runPostgresMigrations,
} from "./postgres"
import {
  createSQLiteConnection,
  createConversationRepository as createSqliteConversationRepository,
  createMessagePartRepository as createSqliteMessagePartRepository,
  createMessageRepository as createSqliteMessageRepository,
  createModelRepository as createSqliteModelRepository,
  createProjectRepository as createSqliteProjectRepository,
  runMigrations as runSqliteMigrations,
  type DrizzleDB as SqliteDrizzleDB,
} from "./sqlite"

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
  const messageParts = createMemoryMessagePartRepository()
  const models = createMemoryModelRepository()

  return {
    projects,
    conversations,
    messages,
    messageParts,
    models,
    async transaction<T>(fn: (uow: UnitOfWork) => Promise<T>): Promise<T> {
      // Memory adapter: pass-through (no real transaction needed)
      // The same repositories are used since Map operations are synchronous
      return fn({ projects, conversations, messages, messageParts, models })
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
    messageParts: createSqliteMessagePartRepository(dbOrTx),
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
    messageParts: createPostgresMessagePartRepository(dbOrTx),
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
