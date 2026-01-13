import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import type { Context } from "@ifc-viewer/core"
import { closeLogs, createLogger } from "@ifc-viewer/logger"
import { createAppContext } from "./context"
import { createApp } from "./create-app"

const log = createLogger("openapi")

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const MONOREPO_ROOT = resolve(__dirname, "..", "..", "..")
const OPENAPI_OUTPUT_PATH = resolve(MONOREPO_ROOT, "packages", "sdk", "openapi.json")
const OPENAPI_URL = "http://localhost/swagger/json"

let ctx: Context | null = null
let exitCode = 0

try {
  ctx = await createAppContext("offline")

  const app = createApp(ctx)
  const response = await app.handle(new Request(OPENAPI_URL))

  if (!response.ok) {
    throw new Error(`Failed to generate OpenAPI spec: ${response.status} ${response.statusText}`)
  }

  const spec = await response.json()
  await Bun.write(OPENAPI_OUTPUT_PATH, `${JSON.stringify(spec, null, 2)}\n`)
  log.info("OpenAPI spec generated", { path: OPENAPI_OUTPUT_PATH })
} catch (error) {
  exitCode = 1
  log.error("OpenAPI generation failed", {
    error: error instanceof Error ? error.message : String(error),
  })
} finally {
  if (ctx) {
    await ctx.dispose()
  }
  await closeLogs()
  process.exit(exitCode)
}
