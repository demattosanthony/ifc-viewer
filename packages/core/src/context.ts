/**
 * Application Context
 *
 * Wires all dependencies together, enabling DI without classes.
 */

import type { DatabaseOps, StorageOps, ComputeOps } from "./ops"

/** Application context with all operations */
export type Context = {
  db: DatabaseOps
  storage: StorageOps
  compute: ComputeOps
  /** Get compute for a specific workspace (future: per-workspace containers) */
  getCompute(workspaceId: string): ComputeOps
  dispose(): Promise<void>
}

/** Configuration for creating context */
export type ContextConfig = {
  db: DatabaseOps
  storage: StorageOps
  compute: ComputeOps
  /** Optional: custom getCompute implementation for per-workspace compute */
  getCompute?: (workspaceId: string) => ComputeOps
}

/** Create a context from pre-configured operations */
export const createContext = (config: ContextConfig): Context => ({
  db: config.db,
  storage: config.storage,
  compute: config.compute,
  getCompute: config.getCompute ?? ((_workspaceId) => config.compute),
  async dispose() {
    await config.compute.dispose()
    await config.db.dispose()
    if (config.storage.dispose) {
      await config.storage.dispose()
    }
  },
})

/** Helper to run a function with context, ensuring cleanup on error */
export const withContext = async <T>(
  ctx: Context,
  fn: (ctx: Context) => Promise<T>
): Promise<T> => {
  try {
    return await fn(ctx)
  } finally {
    await ctx.dispose()
  }
}
