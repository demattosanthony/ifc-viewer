/**
 * Application Context
 *
 * Wires dependencies together and manages compute lifecycle.
 * Compute is created on-demand per project and disposed after 5 minutes of inactivity.
 * Project files are automatically copied from storage on first compute creation.
 */

import { createLogger } from "@ifc-viewer/logger"
import type { AIProvider, Computer, Database, IFCProcessor, Storage, StreamStore } from "./ports"
import { type ChangeTracker, createChangeTracker } from "./services/change-tracker"
import { createIFCSyncHandler } from "./services/ifc-sync.service"

const log = createLogger("context")

const IDLE_TIMEOUT_MS = 5 * 60 * 1000

// ============================================================================
// Types
// ============================================================================

/** Creates a compute instance for a project */
export type ComputeFactory = (projectId: string) => Promise<Computer>

interface ComputeState {
  computer: Computer
  tracker: ChangeTracker
  idleTimer: Timer
}

export type Context = {
  db: Database
  storage: Storage
  ai: AIProvider
  streams: StreamStore
  ifcProcessor: IFCProcessor
  getCompute(projectId: string): Computer | undefined
  getTracker(projectId: string): ChangeTracker | undefined
  getOrCreateCompute(projectId: string): Promise<{ computer: Computer; tracker: ChangeTracker }>
  touchCompute(projectId: string): void
  disposeCompute(projectId: string): Promise<void>
  dispose(): Promise<void>
}

export type ContextConfig = {
  db: Database
  storage: Storage
  ai: AIProvider
  streams: StreamStore
  ifcProcessor: IFCProcessor
  computeFactory: ComputeFactory
}

// ============================================================================
// Context Factory
// ============================================================================

export function createContext(config: ContextConfig): Context {
  const computes = new Map<string, ComputeState>()
  const pendingCreations = new Map<
    string,
    Promise<{ computer: Computer; tracker: ChangeTracker }>
  >()

  // Create IFC sync handler for automatic fragment regeneration
  const onFileSync = createIFCSyncHandler({
    db: config.db,
    storage: config.storage,
    ifcProcessor: config.ifcProcessor,
  })

  const scheduleIdle = (projectId: string): Timer => {
    return setTimeout(async () => {
      log.debug("Compute idle, disposing", { projectId })
      await cleanup(projectId)
    }, IDLE_TIMEOUT_MS)
  }

  const cleanup = async (projectId: string): Promise<void> => {
    const state = computes.get(projectId)
    if (!state) return

    clearTimeout(state.idleTimer)
    computes.delete(projectId)

    // Persist any pending file changes
    if (state.tracker.hasPending()) {
      try {
        log.debug("Persisting pending changes", { projectId })
        const { persisted } = await state.tracker.persist()
        log.debug("Persisted changes", { projectId, count: persisted.length })
      } catch (err) {
        log.error("Failed to persist changes", { projectId, error: err })
      }
    }

    try {
      await state.computer.dispose()
    } catch (err) {
      log.error("Failed to dispose compute", { projectId, error: err })
    }
  }

  /** Copy project files from storage into compute on first creation */
  const copyProjectFiles = async (projectId: string, computer: Computer): Promise<void> => {
    const prefix = `projects/${projectId}/`

    for await (const entry of config.storage.list(prefix)) {
      const relativePath = entry.key.slice(prefix.length)
      if (!relativePath) continue

      const obj = await config.storage.get(entry.key)
      if (!obj) continue

      const parentDir = relativePath.includes("/")
        ? relativePath.slice(0, relativePath.lastIndexOf("/"))
        : null

      if (parentDir) {
        await computer.files.mkdir(parentDir, { recursive: true }).catch(() => {})
      }

      await computer.files.write(relativePath, obj.data)
    }
  }

  return {
    db: config.db,
    storage: config.storage,
    ai: config.ai,
    streams: config.streams,
    ifcProcessor: config.ifcProcessor,

    getCompute(projectId: string): Computer | undefined {
      return computes.get(projectId)?.computer
    },

    getTracker(projectId: string): ChangeTracker | undefined {
      return computes.get(projectId)?.tracker
    },

    async getOrCreateCompute(
      projectId: string
    ): Promise<{ computer: Computer; tracker: ChangeTracker }> {
      const existing = computes.get(projectId)
      if (existing) {
        clearTimeout(existing.idleTimer)
        existing.idleTimer = scheduleIdle(projectId)
        return { computer: existing.computer, tracker: existing.tracker }
      }

      const pending = pendingCreations.get(projectId)
      if (pending) return pending

      const promise = (async () => {
        try {
          log.debug("Creating compute", { projectId })
          const computer = await config.computeFactory(projectId)

          // Copy project files from storage into compute
          await copyProjectFiles(projectId, computer)

          const tracker = createChangeTracker({
            computer,
            storage: config.storage,
            projectId,
            onFileSync,
          })
          computes.set(projectId, { computer, tracker, idleTimer: scheduleIdle(projectId) })
          log.debug("Compute ready", { projectId })
          return { computer, tracker }
        } finally {
          pendingCreations.delete(projectId)
        }
      })()

      pendingCreations.set(projectId, promise)
      return promise
    },

    touchCompute(projectId: string): void {
      const state = computes.get(projectId)
      if (state) {
        clearTimeout(state.idleTimer)
        state.idleTimer = scheduleIdle(projectId)
      }
    },

    async disposeCompute(projectId: string): Promise<void> {
      await cleanup(projectId)
    },

    async dispose(): Promise<void> {
      const projectIds = Array.from(computes.keys())
      if (projectIds.length > 0) {
        log.info("Shutting down compute instances", { count: projectIds.length })
      }
      for (const projectId of projectIds) {
        await cleanup(projectId)
      }
      await config.streams.dispose()
      await config.db.dispose()
      await config.storage.dispose?.()
    },
  }
}

export async function withContext<T>(ctx: Context, fn: (ctx: Context) => Promise<T>): Promise<T> {
  try {
    return await fn(ctx)
  } finally {
    await ctx.dispose()
  }
}
