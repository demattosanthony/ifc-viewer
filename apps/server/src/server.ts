import { Elysia } from "elysia"
import { openapi } from "@elysiajs/openapi"
import { cors } from "@elysiajs/cors"
import { zodToJsonSchema } from "zod-to-json-schema"
import { createAppContext } from "./context"
import { ApiInfoResponse, HealthResponse } from "@ifc-viewer/interface"
import {
  projectsRoutes,
  workspacesRoutes,
  filesRoutes,
  conversationRoutes,
  terminalRoutes,
} from "./routes"

// Create app context
const ctx = await createAppContext()

// Create Elysia app
const app = new Elysia()
  .use(cors())
  .use(
    openapi({
      path: "/swagger",
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
        zod: (schema: unknown) => zodToJsonSchema(schema as Parameters<typeof zodToJsonSchema>[0], { target: "openApi3", $refStrategy: "root" }),
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
  .listen(process.env.PORT ?? 3000)

console.log(`API is running at ${app.server?.hostname}:${app.server?.port}`)
console.log(`Swagger docs: http://localhost:${app.server?.port}/swagger`)

// Export app type for Eden treaty SDK generation
export type App = typeof app

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down...")
  await ctx.dispose()
  process.exit(0)
})

process.on("SIGINT", async () => {
  console.log("Shutting down...")
  await ctx.dispose()
  process.exit(0)
})
