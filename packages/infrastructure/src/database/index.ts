/**
 * Database Adapters
 *
 * Provides SQLite, Postgres, and memory-based database implementations.
 */

export {
  createDatabase,
  type DatabaseConfig,
  type SQLiteDatabaseConfig,
  type MemoryDatabaseConfig,
  type PostgresDatabaseConfig,
} from "./factory"

// Re-export provider-specific types if needed
export * as sqlite from "./sqlite"
export * as postgres from "./postgres"
export * as memory from "./memory"
