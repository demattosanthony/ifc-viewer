import { createDatabase, type DatabaseProvider } from "@ifc-viewer/database";
import {
  createLocalComputer,
  type Computer,
  type ComputerConfig,
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

  /** Shared computer instance for all sessions */
  computer: Computer;

  /** Get the computer (same for all sessions in dev mode) */
  getComputer(sessionId: string): Computer;

  /** Dispose all resources */
  dispose(): Promise<void>;
}

/**
 * Configuration for creating the app context
 */
export interface AppContextConfig {
  /** Working directory for the computer */
  workingDirectory?: string;
  /** Default session TTL in milliseconds */
  sessionTtlMs?: number;
}

// Sample files to include in the workspace
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
 *
 * For local development, all sessions share the same computer/workspace.
 * This means changes persist across sessions.
 */
export async function createAppContext(
  config: AppContextConfig = {}
): Promise<AppContext> {
  const workingDirectory =
    config.workingDirectory ??
    process.env.PLAYGROUND_WORKING_DIR ??
    resolve(process.cwd(), "workspace");

  // Ensure working directory exists
  await mkdir(workingDirectory, { recursive: true });

  // Create a single shared computer for all sessions
  const computer = await createLocalComputer({
    workingDirectory,
    cleanup: false, // Don't cleanup - persist changes
  });

  // Write sample files if they don't exist
  await writeSampleFiles(computer);

  // Create database for session tracking (TTL handling)
  const db = createDatabase({
    type: "memory",
    workingDirectory,
    defaultTtlMs: config.sessionTtlMs ?? 5 * 60 * 1000, // 5 minutes
    events: {
      onSessionExpired: async (sessionId) => {
        console.log(`[Context] Session ${sessionId} expired`);
        // In shared mode, we don't dispose anything on session expiry
        // The computer persists and is shared across all sessions
      },
    },
  });

  const context: AppContext = {
    db,
    computer,

    getComputer(_sessionId: string) {
      // All sessions share the same computer in local dev mode
      return computer;
    },

    async dispose() {
      await computer.dispose();
      await db.dispose();
    },
  };

  return context;
}

/**
 * Write sample files to the workspace if they don't exist
 */
async function writeSampleFiles(computer: Computer): Promise<void> {
  // Write static sample files
  for (const [filename, content] of Object.entries(SAMPLE_FILES)) {
    try {
      await computer.files.stat(filename);
      // File exists, skip
    } catch {
      // File doesn't exist, create it
      await computer.files.write(filename, content);
    }
  }

  // Load sample IFC file if it doesn't exist
  try {
    await computer.files.stat("sample.ifc");
  } catch {
    try {
      const ifcContent = await readFile(SAMPLE_IFC_PATH, "utf-8");
      await computer.files.write("sample.ifc", ifcContent);
    } catch (err) {
      console.warn("[Context] Could not load sample.ifc:", err);
    }
  }

  // Load sample Python script if it doesn't exist
  try {
    await computer.files.stat("print_info.py");
  } catch {
    try {
      const pyContent = await readFile(SAMPLE_PY_SCRIPT_PATH, "utf-8");
      await computer.files.write("print_info.py", pyContent);
    } catch (err) {
      console.warn("[Context] Could not load print_info.py:", err);
    }
  }
}
