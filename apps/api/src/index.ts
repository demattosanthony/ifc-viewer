import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { createAppContext } from "./context";
import { sessionsRoutes } from "./routes/sessions";
import { filesRoutes } from "./routes/files";
import { agentRoutes } from "./routes/agent";
import { terminalRoutes } from "./routes/terminal";

// Create app context
const ctx = await createAppContext();

// Create Elysia app
const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "IFC Viewer API",
          version: "1.0.0",
          description:
            "API for IFC Viewer platform with session management, file operations, and AI agent",
        },
        tags: [
          { name: "Sessions", description: "Session management" },
          { name: "Files", description: "File operations" },
          { name: "Agent", description: "AI agent chat" },
          { name: "Terminal", description: "Terminal WebSocket" },
        ],
      },
    })
  )
  .get("/", () => ({
    message: "IFC Viewer API",
    version: "1.0.0",
    docs: "/swagger",
  }))
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
  .use(sessionsRoutes(ctx))
  .use(filesRoutes(ctx))
  .use(agentRoutes(ctx))
  .use(terminalRoutes(ctx))
  .listen(process.env.PORT ?? 3000);

console.log(`API is running at ${app.server?.hostname}:${app.server?.port}`);
console.log(`Swagger docs: http://localhost:${app.server?.port}/swagger`);

// Export app type for Eden treaty SDK generation
export type App = typeof app;

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await ctx.dispose();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await ctx.dispose();
  process.exit(0);
});
