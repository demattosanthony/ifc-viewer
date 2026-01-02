import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { createAppContext } from "./context";
import { ApiInfoResponse, HealthResponse } from "./schemas";
import { projectsRoutes } from "./features/projects/projects.routes";
import { workspacesRoutes } from "./features/workspaces/workspaces.routes";
import { filesRoutes } from "./features/files";
import { agentRoutes } from "./features/agent";
import { terminalRoutes } from "./features/terminal/terminal.routes";

// Create app context
const ctx = await createAppContext();

// Create Elysia app
const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "BIM IDE API",
          version: "2.0.0",
          description:
            "API for BIM IDE platform with project/workspace management, file operations, and AI agent",
        },
        tags: [
          { name: "Projects", description: "Project management" },
          { name: "Workspaces", description: "Workspace management" },
          { name: "Files", description: "File operations" },
          { name: "Agent", description: "AI agent chat" },
          { name: "Terminal", description: "Terminal WebSocket" },
        ],
      },
    })
  )
  .get(
    "/",
    () => ({
      message: "BIM IDE API",
      version: "2.0.0",
      docs: "/swagger",
    }),
    {
      response: {
        200: ApiInfoResponse,
      },
      detail: {
        summary: "API info",
        tags: ["General"],
      },
    }
  )
  .get(
    "/health",
    () => ({
      status: "ok" as const,
      timestamp: new Date().toISOString(),
    }),
    {
      response: {
        200: HealthResponse,
      },
      detail: {
        summary: "Health check",
        tags: ["General"],
      },
    }
  )
  .use(projectsRoutes(ctx))
  .use(workspacesRoutes(ctx))
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
