import { Database } from "bun:sqlite"
import { mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import * as schema from "./schema"

/** Drizzle database instance type */
export type DrizzleDB = BunSQLiteDatabase<typeof schema>

/**
 * Drizzle transaction type - structurally compatible with DrizzleDB.
 * We use Pick to extract only the methods we need (insert, select, update, delete)
 * which are available on both the db and transaction objects.
 */
export type DrizzleTransaction = Pick<DrizzleDB, "insert" | "select" | "update" | "delete">

export interface SQLiteConnectionConfig {
  filename: string
}

/**
 * Create SQLite database connection with Drizzle ORM
 */
export async function createSQLiteConnection(
  config: SQLiteConnectionConfig
): Promise<{ db: DrizzleDB; close: () => void }> {
  // Ensure directory exists for file-based databases
  if (config.filename !== ":memory:") {
    await mkdir(dirname(config.filename), { recursive: true })
  }

  const sqlite = new Database(config.filename)

  // Enable WAL mode for better concurrent performance
  sqlite.run("PRAGMA journal_mode = WAL;")

  const db = drizzle(sqlite, { schema })

  return {
    db,
    close: () => sqlite.close(),
  }
}

/**
 * Run Drizzle migrations from the migrations folder
 */
export function runMigrations(db: DrizzleDB): void {
  const migrationsFolder = resolve(import.meta.dir, "./migrations")
  migrate(db, { migrationsFolder })
}
