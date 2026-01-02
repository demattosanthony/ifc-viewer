import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/providers/postgres/schema.ts",
  out: "./src/drizzle-pg",
  dialect: "postgresql",
});
