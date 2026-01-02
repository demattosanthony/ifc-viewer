import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

export type DrizzleDB = BunSQLiteDatabase<typeof schema>;

export interface SQLiteConnectionConfig {
  filename: string;
}

/**
 * Create SQLite database connection with Drizzle ORM
 */
export async function createSQLiteConnection(
  config: SQLiteConnectionConfig
): Promise<{ db: DrizzleDB; close: () => void }> {
  // Ensure directory exists for file-based databases
  if (config.filename !== ":memory:") {
    await mkdir(dirname(config.filename), { recursive: true });
  }

  const sqlite = new Database(config.filename);

  // Enable WAL mode for better concurrent performance
  sqlite.run("PRAGMA journal_mode = WAL;");

  const db = drizzle(sqlite, { schema });

  return {
    db,
    close: () => sqlite.close(),
  };
}

/**
 * Run Drizzle migrations from the migrations folder
 */
export function runMigrations(db: DrizzleDB): void {
  const migrationsFolder = resolve(import.meta.dir, "./migrations");
  migrate(db, { migrationsFolder });
}
