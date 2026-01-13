import { cors } from "@elysiajs/cors"
import { openapi } from "@elysiajs/openapi"
import type { Context } from "@ifc-viewer/core"
import { ApiInfoResponse, HealthResponse } from "@ifc-viewer/interface"
import { Elysia } from "elysia"
import { zodToJsonSchema } from "zod-to-json-schema"

import {
  conversationRoutes,
  modelsRoutes,
  projectFilesRoutes,
  projectsRoutes,
  terminalRoutes,
} from "./routes"

export function createApp(ctx: Context) {
  return new Elysia()
    .use(
      cors({
        origin: true, // Allow all origins (configure for production)
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
        exposeHeaders: ["Content-Length", "Content-Type"],
        credentials: true,
        maxAge: 86400, // 24 hours
      })
    )
    .use(
      openapi({
        path: "/swagger",
        provider: "swagger-ui",
        specPath: "/swagger/json",
        documentation: {
          info: {
            title: "IFC Viewer API",
            version: "2.0.0",
            description:
              "API for IFC Viewer platform with project management, file operations, and AI agent",
          },
          tags: [
            { name: "Projects", description: "Project management" },
            { name: "Models", description: "IFC model management" },
            { name: "Project Files", description: "Project file operations" },
            { name: "Conversations", description: "AI conversations and chat" },
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
        message: "IFC Viewer API",
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
    .use(projectFilesRoutes(ctx))
    .use(modelsRoutes(ctx))
    .use(conversationRoutes(ctx))
    .use(terminalRoutes(ctx))
}
