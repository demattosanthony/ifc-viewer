import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { cors } from "@elysiajs/cors";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createLogger, closeLogs } from "@ifc-viewer/logger";
import { createAppContext } from "./context";
import { ApiInfoResponse, HealthResponse } from "@ifc-viewer/interface";

const log = createLogger("server");
import {
  projectsRoutes,
  workspacesRoutes,
  filesRoutes,
  conversationRoutes,
  terminalRoutes,
} from "./routes";

// Create app context
const ctx = await createAppContext();

// Create Elysia app
const app = new Elysia()
  .use(cors())
  .use(
    openapi({
      path: "/swagger",
      provider: "swagger-ui",
      specPath: "/swagger/json",
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
          { name: "Conversations", description: "AI conversations and chat" },
          { name: "Terminal", description: "Terminal WebSocket" },
        ],
      },
      // Map Zod schemas to JSON Schema for OpenAPI docs
      mapJsonSchema: {
        zod: (schema: unknown) =>
          zodToJsonSchema(schema as Parameters<typeof zodToJsonSchema>[0], {
            target: "openApi3",
            $refStrategy: "root",
          }),
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
        operationId: "getApiInfo",
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
        operationId: "healthCheck",
      },
    }
  )
  .use(projectsRoutes(ctx))
  .use(workspacesRoutes(ctx))
  .use(filesRoutes(ctx))
  .use(conversationRoutes(ctx))
  .use(terminalRoutes(ctx))
  .listen(process.env.PORT ?? 3000);

log.info("API server started", {
  host: app.server?.hostname,
  port: app.server?.port,
  swagger: `http://localhost:${app.server?.port}/swagger`,
});

// Export app type for Eden treaty SDK generation
export type App = typeof app;

// Graceful shutdown
async function shutdown(signal: string) {
  log.info("Shutting down", { signal });
  await ctx.dispose();
  await closeLogs();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
