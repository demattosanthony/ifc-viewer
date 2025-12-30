import { createDatabase, type DatabaseProvider } from "@ifc-viewer/database";
import {
  createLocalSandbox,
  type Sandbox,
  type SandboxConfig,
} from "@ifc-viewer/compute";
import { mkdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Application context containing shared resources
 */
export interface AppContext {
  /** Database provider for session management */
  db: DatabaseProvider;

  /** Active sandboxes mapped by session ID */
  sandboxes: Map<string, Sandbox>;

  /** Get a sandbox for a session */
  getSandbox(sessionId: string): Sandbox | undefined;

  /** Create a sandbox for a session */
  createSandbox(
    sessionId: string,
    config?: Partial<SandboxConfig>
  ): Promise<Sandbox>;

  /** Dispose a sandbox */
  disposeSandbox(sessionId: string): Promise<void>;

  /** Dispose all resources */
  dispose(): Promise<void>;
}

/**
 * Configuration for creating the app context
 */
export interface AppContextConfig {
  /** Base working directory for sandboxes */
  workingDirectory?: string;
  /** Default session TTL in milliseconds */
  sessionTtlMs?: number;
}

// Sample files to include in new sessions (static content)
const SAMPLE_FILES = {
  "README.md":
    "Welcome to the IFC Viewer Playground! This is a sample README file.",
};

// Path to sample IFC file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SAMPLE_IFC_PATH = resolve(__dirname, "..", "assets", "sample.ifc");
const SAMPLE_PY_SCRIPT_PATH = resolve(
  __dirname,
  "..",
  "assets",
  "print_info.py"
);

/**
 * Create the application context
 */
export async function createAppContext(
  config: AppContextConfig = {}
): Promise<AppContext> {
  const workingDirectory =
    config.workingDirectory ??
    process.env.PLAYGROUND_WORKING_DIR ??
    "/tmp/ifc-viewer-playground";

  // Ensure working directory exists
  await mkdir(workingDirectory, { recursive: true });

  const sandboxes = new Map<string, Sandbox>();

  // Create database with session expiry handling
  const db = createDatabase({
    type: "memory",
    workingDirectory,
    defaultTtlMs: config.sessionTtlMs ?? 5 * 60 * 1000, // 5 minutes
    events: {
      onSessionExpired: async (sessionId) => {
        console.log(
          `[Context] Session ${sessionId} expired, cleaning up sandbox`
        );
        const sandbox = sandboxes.get(sessionId);
        if (sandbox) {
          await sandbox.dispose();
          sandboxes.delete(sessionId);
        }
      },
    },
  });

  const context: AppContext = {
    db,
    sandboxes,

    getSandbox(sessionId: string) {
      return sandboxes.get(sessionId);
    },

    async createSandbox(
      sessionId: string,
      sandboxConfig?: Partial<SandboxConfig>
    ) {
      // Check if sandbox already exists
      const existing = sandboxes.get(sessionId);
      if (existing) {
        return existing;
      }

      // Create sandbox working directory
      const sandboxWorkDir = resolve(workingDirectory, sessionId);
      await mkdir(sandboxWorkDir, { recursive: true });

      // Create the sandbox
      const sandbox = await createLocalSandbox({
        workingDirectory: sandboxWorkDir,
        environment: sandboxConfig?.environment,
        storageUrlMode: sandboxConfig?.storageUrlMode ?? "data",
      });

      // Write sample files
      for (const [filename, content] of Object.entries(SAMPLE_FILES)) {
        await sandbox.storage.put(filename, content);
      }

      // Load sample IFC file
      try {
        const ifcContent = await readFile(SAMPLE_IFC_PATH, "utf-8");
        await sandbox.storage.put("sample.ifc", ifcContent);
      } catch (err) {
        console.warn("[Context] Could not load sample.ifc:", err);
      }

      // Load sample Python script
      try {
        const pyContent = await readFile(SAMPLE_PY_SCRIPT_PATH, "utf-8");
        await sandbox.storage.put("print_info.py", pyContent);
      } catch (err) {
        console.warn("[Context] Could not load print_info.py:", err);
      }

      sandboxes.set(sessionId, sandbox);
      return sandbox;
    },

    async disposeSandbox(sessionId: string) {
      const sandbox = sandboxes.get(sessionId);
      if (sandbox) {
        await sandbox.dispose();
        sandboxes.delete(sessionId);
      }
    },

    async dispose() {
      // Dispose all sandboxes
      const disposePromises = Array.from(sandboxes.values()).map((s) =>
        s.dispose()
      );
      await Promise.all(disposePromises);
      sandboxes.clear();

      // Dispose database
      await db.dispose();
    },
  };

  return context;
}
