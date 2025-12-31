import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/providers/sqlite/schema.ts",
  out: "./src/drizzle",
  dialect: "sqlite",
});
