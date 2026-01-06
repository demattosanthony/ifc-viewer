import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/database/sqlite/schema.ts",
  out: "./src/database/sqlite/migrations",
  dialect: "sqlite",
})
