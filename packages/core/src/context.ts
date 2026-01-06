/**
 * Application Context
 *
 * Wires all dependencies together, enabling Dependency Injection without classes.
 * Manages compute lifecycle with activity-based idle detection.
 */

import type { Database, Storage, Computer, AIProvider } from "./ports";

// ============================================================================
// Constants
// ============================================================================

/** Idle timeout before disposing compute (5 minutes) */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/** Interval for checking idle workspaces (30 seconds) */
const IDLE_CHECK_INTERVAL_MS = 30 * 1000;

// ============================================================================
// Types
// ============================================================================

/** Compute factory for creating per-workspace compute instances */
export type ComputeFactory = (
  workspaceId: string,
  workingDirectory: string
) => Promise<Computer>;

/** Callback when workspace becomes idle and should be cleaned up */
export type OnWorkspaceIdle = (workspaceId: string) => Promise<void>;

/** Activity source for logging */
export type ActivitySource =
  | "terminal"
  | "file-read"
  | "file-write"
  | "file-delete"
  | "ai-chat";

/** Internal state for a compute instance */
interface ComputeState {
  computer: Computer;
  lastActivityAt: number;
}

/** Application context with all infrastructure */
export type Context = {
  db: Database;
  storage: Storage;
  ai: AIProvider;
  workspacesDir: string;
  getCompute(workspaceId: string): Computer | undefined;
  getOrCreateCompute(
    workspaceId: string,
    workingDirectory: string
  ): Promise<Computer>;
  touchCompute(workspaceId: string, source: ActivitySource): void;
  disposeCompute(workspaceId: string): Promise<void>;
  dispose(): Promise<void>;
};

/** Configuration for creating context */
export type ContextConfig = {
  db: Database;
  storage: Storage;
  ai: AIProvider;
  workspacesDir: string;
  computeFactory: ComputeFactory;
  onWorkspaceIdle?: OnWorkspaceIdle;
};

// ============================================================================
// Context Factory
// ============================================================================

/** Create a context from pre-configured infrastructure */
export function createContext(config: ContextConfig): Context {
  const computeStates = new Map<string, ComputeState>();
  const pendingCreations = new Map<string, Promise<Computer>>();
  let idleCheckInterval: Timer | null = null;

  // Start the idle checker
  const startIdleChecker = (): void => {
    if (idleCheckInterval) return;

    idleCheckInterval = setInterval(async () => {
      const now = Date.now();

      for (const [workspaceId, state] of computeStates) {
        const idleMs = now - state.lastActivityAt;

        if (idleMs >= IDLE_TIMEOUT_MS) {
          console.log(
            `[Compute] Workspace ${workspaceId} idle for ${Math.round(
              idleMs / 1000
            )}s, disposing...`
          );

          if (config.onWorkspaceIdle) {
            try {
              await config.onWorkspaceIdle(workspaceId);
            } catch (err) {
              console.error(
                `[Compute] Failed to cleanup workspace ${workspaceId}:`,
                err
              );
            }
          } else {
            // Default: just dispose compute
            await ctx.disposeCompute(workspaceId);
          }
        }
      }
    }, IDLE_CHECK_INTERVAL_MS);
  };

  const stopIdleChecker = (): void => {
    if (idleCheckInterval) {
      clearInterval(idleCheckInterval);
      idleCheckInterval = null;
    }
  };

  const ctx: Context = {
    db: config.db,
    storage: config.storage,
    ai: config.ai,
    workspacesDir: config.workspacesDir,

    getCompute(workspaceId: string): Computer | undefined {
      return computeStates.get(workspaceId)?.computer;
    },

    async getOrCreateCompute(
      workspaceId: string,
      workingDirectory: string
    ): Promise<Computer> {
      // Return existing instance and touch activity
      const existing = computeStates.get(workspaceId);
      if (existing) {
        existing.lastActivityAt = Date.now();
        return existing.computer;
      }

      // Wait for pending creation if already in progress
      const pending = pendingCreations.get(workspaceId);
      if (pending) return pending;

      // Create new instance
      const creationPromise = (async () => {
        try {
          console.log(
            `[Compute] Creating compute for workspace ${workspaceId}`
          );
          const computer = await config.computeFactory(
            workspaceId,
            workingDirectory
          );

          computeStates.set(workspaceId, {
            computer,
            lastActivityAt: Date.now(),
          });

          // Start idle checker if this is the first compute
          if (computeStates.size === 1) {
            startIdleChecker();
          }

          console.log(`[Compute] Compute ready for workspace ${workspaceId}`);
          return computer;
        } finally {
          pendingCreations.delete(workspaceId);
        }
      })();

      pendingCreations.set(workspaceId, creationPromise);
      return creationPromise;
    },

    touchCompute(workspaceId: string, source: ActivitySource): void {
      const state = computeStates.get(workspaceId);
      if (state) {
        state.lastActivityAt = Date.now();
        console.log(
          `[Compute] Activity on workspace ${workspaceId} (${source})`
        );
      }
    },

    async disposeCompute(workspaceId: string): Promise<void> {
      const state = computeStates.get(workspaceId);
      if (!state) return;

      console.log(`[Compute] Disposing compute for workspace ${workspaceId}`);
      await state.computer.dispose();
      computeStates.delete(workspaceId);

      // Stop idle checker if no more computes
      if (computeStates.size === 0) {
        stopIdleChecker();
      }
    },

    async dispose(): Promise<void> {
      stopIdleChecker();

      // Dispose all compute instances
      for (const [workspaceId, state] of computeStates) {
        console.log(`[Compute] Disposing compute for workspace ${workspaceId}`);
        await state.computer.dispose();
      }
      computeStates.clear();

      await config.db.dispose();
      if (config.storage.dispose) {
        await config.storage.dispose();
      }
    },
  };

  return ctx;
}

/** Helper to run a function with context, ensuring cleanup on error */
export async function withContext<T>(
  ctx: Context,
  fn: (ctx: Context) => Promise<T>
): Promise<T> {
  try {
    return await fn(ctx);
  } finally {
    await ctx.dispose();
  }
}
