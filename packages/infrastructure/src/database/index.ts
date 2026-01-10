/**
 * Database Adapters
 *
 * Provides SQLite, Postgres, and memory-based database implementations.
 */

export {
  createDatabase,
  type DatabaseConfig,
  type MemoryDatabaseConfig,
  type PostgresDatabaseConfig,
  type SQLiteDatabaseConfig,
} from "./factory"
export * as memory from "./memory"
export * as postgres from "./postgres"
// Re-export provider-specific types if needed
export * as sqlite from "./sqlite"
