/**
 * Test Context Factory
 *
 * Creates isolated offline contexts for E2E testing.
 * Uses memory database, memory storage, and local compute.
 */

import { type AIProvider, type Context, createContext } from "@ifc-viewer/core"
import {
  createDatabase,
  createLocalComputer,
  createMemoryStreamStore,
  createStorage,
  createThatOpenIFCProcessor,
} from "@ifc-viewer/infrastructure"
import { createApp } from "../../src/create-app.ts"

export interface TestApp {
  app: ReturnType<typeof createApp>
  ctx: Context
  dispose: () => Promise<void>
}

/**
 * Creates a mock AI provider for testing.
 * Returns no-op implementations since E2E tests don't test AI functionality.
 */
function createMockAIProvider(): AIProvider {
  return {
    id: "mock",
    async *streamChat() {
      // No-op for E2E tests not testing AI
    },
  }
}

/**
 * Creates an isolated test app with in-memory dependencies.
 * Each test should create a fresh instance and dispose it after.
 */
export async function createTestApp(): Promise<TestApp> {
  const db = await createDatabase({ type: "memory" })
  const storage = createStorage({ type: "memory" })
  const streams = createMemoryStreamStore({ ttlMs: 60 * 1000 })
  const ifcProcessor = createThatOpenIFCProcessor()
  const ai = createMockAIProvider()

  // Track temp directories for cleanup
  const tempDirs: string[] = []

  const ctx = createContext({
    db,
    storage,
    ai,
    streams,
    ifcProcessor,
    async computeFactory(projectId) {
      // Use temp directory for local compute in tests
      const tmpDir = `/tmp/test-workspace-${projectId}-${Date.now()}`
      await Bun.$`mkdir -p ${tmpDir}`.quiet()
      tempDirs.push(tmpDir)
      return createLocalComputer({ workingDirectory: tmpDir, cleanup: true })
    },
  })

  const app = createApp(ctx)

  return {
    app,
    ctx,
    async dispose() {
      await ctx.dispose()
      // Clean up temp directories
      for (const dir of tempDirs) {
        await Bun.$`rm -rf ${dir}`.quiet().nothrow()
      }
    },
  }
}
