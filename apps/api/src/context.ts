import { createDatabase, type DatabaseProvider } from "@ifc-viewer/database";
import { createClient, type IFCViewerClient } from "@ifc-viewer/core";
import { createLocalComputer, type Computer } from "@ifc-viewer/compute";
import { mkdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface AppContext {
  client: IFCViewerClient;
  db: DatabaseProvider;
  computer: Computer;
  getComputer(sessionId: string): Computer;
  dispose(): Promise<void>;
}

export interface AppContextConfig {
  workingDirectory?: string;
  dataDirectory?: string;
  sessionTtlMs?: number;
}

const SAMPLE_FILES = {
  "README.md":
    "Welcome to the IFC Viewer Playground! This is a sample README file.",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SAMPLE_IFC_PATH = resolve(__dirname, "..", "assets", "sample.ifc");
const SAMPLE_PY_SCRIPT_PATH = resolve(
  __dirname,
  "..",
  "assets",
  "print_info.py"
);

export async function createAppContext(
  config: AppContextConfig = {}
): Promise<AppContext> {
  const workingDirectory =
    config.workingDirectory ??
    process.env.PLAYGROUND_WORKING_DIR ??
    resolve(process.cwd(), "workspace");

  const dataDirectory =
    config.dataDirectory ??
    process.env.DATA_DIR ??
    resolve(process.cwd(), "data");

  await mkdir(workingDirectory, { recursive: true });
  await mkdir(dataDirectory, { recursive: true });

  const computer = await createLocalComputer({
    workingDirectory,
    cleanup: false,
  });

  await writeSampleFiles(computer);

  const db = await createDatabase({
    dataDirectory,
    defaultWorkingDirectory: workingDirectory,
    defaultTtlMs: config.sessionTtlMs ?? 5 * 60 * 1000,
    events: {
      onSessionExpired: async (sessionId) => {
        console.log(`[Context] Session ${sessionId} expired`);
      },
    },
  });

  const client = createClient({
    db,
    defaultWorkingDirectory: workingDirectory,
    defaultSessionTtlMs: config.sessionTtlMs,
  });

  const context: AppContext = {
    client,
    db,
    computer,

    getComputer(_sessionId: string) {
      return computer;
    },

    async dispose() {
      await client.dispose();
      await computer.dispose();
      await db.dispose();
    },
  };

  return context;
}

async function writeSampleFiles(computer: Computer): Promise<void> {
  for (const [filename, content] of Object.entries(SAMPLE_FILES)) {
    try {
      await computer.files.stat(filename);
    } catch {
      await computer.files.write(filename, content);
    }
  }

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
