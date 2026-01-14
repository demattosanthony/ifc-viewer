import { closeLogs, createLogger } from "@ifc-viewer/logger"
import { createAppContext } from "./context"
import { createApp } from "./create-app"

const log = createLogger("server")

// Create app context
const ctx = await createAppContext()

// Create Elysia app
const app = createApp(ctx)
app.listen({
  port: process.env.PORT ?? 3000,
  // Allow large file uploads (500MB max)
  maxRequestBodySize: 500 * 1024 * 1024,
})

log.info("API server started", {
  host: app.server?.hostname,
  port: app.server?.port,
  swagger: `http://localhost:${app.server?.port}/swagger`,
})

// Export app type for Eden treaty SDK generation
export type App = typeof app

// Graceful shutdown
async function shutdown(signal: string) {
  log.info("Received shutdown signal, cleaning up...", { signal })

  try {
    // dispose() will sync all compute instances to storage and stop containers
    await ctx.dispose()
    log.info("Shutdown complete")
  } catch (err) {
    log.error("Error during shutdown", { error: err })
  }

  await closeLogs()
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))
