import { SQL } from "bun";
import { drizzle, type BunSQLDatabase } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { resolve } from "node:path";
import * as schema from "./schema";

export type DrizzleDB = BunSQLDatabase<typeof schema>;

export interface PostgresConnectionConfig {
  connectionString: string;
}

/**
 * Create Postgres database connection with Drizzle ORM using Bun SQL
 */
export function createPostgresConnection(
  config: PostgresConnectionConfig
): { db: DrizzleDB; close: () => void } {
  const client = new SQL(config.connectionString);
  const db = drizzle({ client, schema });

  return {
    db,
    close: () => {
      client.close();
    },
  };
}

/**
 * Run Drizzle migrations from the Postgres migrations folder
 */
export async function runMigrations(db: DrizzleDB): Promise<void> {
  const migrationsFolder = resolve(import.meta.dir, "../../drizzle-pg");
  await migrate(db, { migrationsFolder });
}
