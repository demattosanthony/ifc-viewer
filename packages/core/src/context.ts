/**
 * Application Context
 *
 * Wires all dependencies together, enabling Dependency Injection without classes.
 */

import type { Database, Storage, Computer } from "./ports"

/** Application context with all infrastructure */
export type Context = {
  db: Database
  storage: Storage
  compute: Computer
  /** Get compute for a specific workspace (future: per-workspace containers) */
  getCompute(workspaceId: string): Computer
  dispose(): Promise<void>
}

/** Configuration for creating context */
export type ContextConfig = {
  db: Database
  storage: Storage
  compute: Computer
  /** Optional: custom getCompute implementation for per-workspace compute */
  getCompute?: (workspaceId: string) => Computer
}

/** Create a context from pre-configured infrastructure */
export function createContext(config: ContextConfig): Context {
  return {
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
