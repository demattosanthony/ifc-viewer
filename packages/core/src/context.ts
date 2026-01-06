/**
 * Application Context
 *
 * Wires all dependencies together, enabling Dependency Injection without classes.
 */

import type { Database, Storage, Computer, AIProvider } from "./ports"

/** Compute factory for creating per-workspace compute instances */
export type ComputeFactory = (workspaceId: string, workingDirectory: string) => Promise<Computer>

/** Callback when workspace has no active connections */
export type OnWorkspaceIdle = (workspaceId: string) => Promise<void>

/** Application context with all infrastructure */
export type Context = {
  db: Database
  storage: Storage
  ai: AIProvider
  /** Base directory for workspace working directories */
  workspacesDir: string
  /** Get compute for a specific workspace (creates if needed) */
  getCompute(workspaceId: string): Computer | undefined
  /** Get or create compute for a workspace */
  getOrCreateCompute(workspaceId: string, workingDirectory: string): Promise<Computer>
  /** Dispose a specific workspace's compute */
  disposeCompute(workspaceId: string): Promise<void>
  /** Register a connection to a workspace (returns unregister function) */
  registerConnection(workspaceId: string): () => void
  /** Get the number of active connections for a workspace */
  getConnectionCount(workspaceId: string): number
  /** Dispose all resources */
  dispose(): Promise<void>
}

/** Configuration for creating context */
export type ContextConfig = {
  db: Database
  storage: Storage
  ai: AIProvider
  /** Base directory for workspace working directories */
  workspacesDir: string
  /** Factory function to create compute instances */
  computeFactory: ComputeFactory
  /** Callback when workspace has no active connections (after grace period) */
  onWorkspaceIdle?: OnWorkspaceIdle
  /** Grace period in ms before triggering idle callback (default: 5000) */
  idleGracePeriodMs?: number
}

/** Create a context from pre-configured infrastructure */
export function createContext(config: ContextConfig): Context {
  const computeInstances = new Map<string, Computer>()
  const pendingCreations = new Map<string, Promise<Computer>>()
  const connectionCounts = new Map<string, number>()
  const idleTimers = new Map<string, Timer>()
  const gracePeriod = config.idleGracePeriodMs ?? 5000

  const scheduleIdleCheck = (workspaceId: string): void => {
    // Clear any existing timer
    const existingTimer = idleTimers.get(workspaceId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      idleTimers.delete(workspaceId)
    }

    // Only schedule if there's a callback and compute exists
    if (!config.onWorkspaceIdle || !computeInstances.has(workspaceId)) {
      return
    }

    // Schedule idle callback after grace period
    const timer = setTimeout(() => {
      idleTimers.delete(workspaceId)
      const count = connectionCounts.get(workspaceId) ?? 0
      if (count === 0 && computeInstances.has(workspaceId)) {
        console.log(`[Context] Workspace ${workspaceId} idle, triggering cleanup`)
        config.onWorkspaceIdle!(workspaceId).catch((err) => {
          console.error(`[Context] Failed to cleanup workspace ${workspaceId}:`, err)
        })
      }
    }, gracePeriod)
    idleTimers.set(workspaceId, timer)
  }

  return {
    db: config.db,
    storage: config.storage,
    ai: config.ai,
    workspacesDir: config.workspacesDir,

    getCompute(workspaceId: string): Computer | undefined {
      return computeInstances.get(workspaceId)
    },

    async getOrCreateCompute(workspaceId: string, workingDirectory: string): Promise<Computer> {
      // Return existing instance
      const existing = computeInstances.get(workspaceId)
      if (existing) return existing

      // Wait for pending creation if already in progress
      const pending = pendingCreations.get(workspaceId)
      if (pending) return pending

      // Create new instance with proper synchronization
      const creationPromise = (async () => {
        try {
          const computer = await config.computeFactory(workspaceId, workingDirectory)
          computeInstances.set(workspaceId, computer)
          return computer
        } finally {
          pendingCreations.delete(workspaceId)
        }
      })()

      pendingCreations.set(workspaceId, creationPromise)
      return creationPromise
    },

    async disposeCompute(workspaceId: string): Promise<void> {
      // Clear any pending idle timer
      const timer = idleTimers.get(workspaceId)
      if (timer) {
        clearTimeout(timer)
        idleTimers.delete(workspaceId)
      }
      // Clear connection count
      connectionCounts.delete(workspaceId)

      const computer = computeInstances.get(workspaceId)
      if (computer) {
        await computer.dispose()
        computeInstances.delete(workspaceId)
      }
    },

    registerConnection(workspaceId: string): () => void {
      // Clear any pending idle timer since we have a new connection
      const existingTimer = idleTimers.get(workspaceId)
      if (existingTimer) {
        clearTimeout(existingTimer)
        idleTimers.delete(workspaceId)
      }

      const current = connectionCounts.get(workspaceId) ?? 0
      connectionCounts.set(workspaceId, current + 1)
      console.log(`[Context] Workspace ${workspaceId} connection registered (total: ${current + 1})`)

      // Return unregister function
      let unregistered = false
      return () => {
        if (unregistered) return
        unregistered = true

        const count = connectionCounts.get(workspaceId) ?? 0
        const newCount = Math.max(0, count - 1)
        connectionCounts.set(workspaceId, newCount)
        console.log(`[Context] Workspace ${workspaceId} connection unregistered (remaining: ${newCount})`)

        if (newCount === 0) {
          scheduleIdleCheck(workspaceId)
        }
      }
    },

    getConnectionCount(workspaceId: string): number {
      return connectionCounts.get(workspaceId) ?? 0
    },

    async dispose() {
      // Clear all idle timers
      for (const timer of idleTimers.values()) {
        clearTimeout(timer)
      }
      idleTimers.clear()
      connectionCounts.clear()

      // Dispose all compute instances
      for (const [id, computer] of computeInstances) {
        await computer.dispose()
        computeInstances.delete(id)
      }
      await config.db.dispose()
      if (config.storage.dispose) {
        await config.storage.dispose()
      }
    },
  }
}

/** Helper to run a function with context, ensuring cleanup on error */
export async function withContext<T>(
  ctx: Context,
  fn: (ctx: Context) => Promise<T>
): Promise<T> {
  try {
    return await fn(ctx)
  } finally {
    await ctx.dispose()
  }
}
