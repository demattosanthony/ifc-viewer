import { createDatabase, type DatabaseProvider } from "@ifc-viewer/database";
import { createLocalComputer, type Computer } from "@ifc-viewer/compute";
import {
  createStorageProvider,
  type StorageProvider,
} from "@ifc-viewer/storage";
import { mkdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sample project assets
const SAMPLE_PROJECT_ID = "sample-project";
const SAMPLE_IFC_PATH = resolve(__dirname, "..", "assets", "sample.ifc");
const SAMPLE_PY_SCRIPT_PATH = resolve(__dirname, "..", "assets", "print_info.py");

export interface AppContext {
  db: DatabaseProvider;
  storage: StorageProvider;
  computer: Computer;
  getComputer(workspaceId: string): Computer;
  
  /**
   * Copy project files from storage to compute working directory
   */
  loadProjectIntoCompute(projectId: string): Promise<void>;
  
  dispose(): Promise<void>;
}

export interface AppContextConfig {
  workingDirectory?: string;
  dataDirectory?: string;
  storageDirectory?: string;
}

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
    resolve(process.cwd(), ".data", "sqlite");

  const storageDirectory =
    config.storageDirectory ??
    process.env.STORAGE_LOCAL_BASE_DIR ??
    resolve(process.cwd(), ".data", "storage");

  // Ensure directories exist
  await mkdir(workingDirectory, { recursive: true });
  await mkdir(dataDirectory, { recursive: true });
  await mkdir(storageDirectory, { recursive: true });

  // Create database
  const db = await createDatabase({ dataDirectory });

  // Create storage provider
  const storage = createStorageProvider({
    type: "local",
    baseDir: storageDirectory,
  });

  // Create compute environment
  const computer = await createLocalComputer({
    workingDirectory,
    cleanup: false,
  });

  // Bootstrap sample project
  await bootstrapSampleProject(db, storage);

  // Load sample project files into compute for initial state
  const ctx: AppContext = {
    db,
    storage,
    computer,

    getComputer(_workspaceId: string) {
      // For now, return the single shared computer
      // In the future, each workspace will have its own computer (Docker container)
      return computer;
    },

    async loadProjectIntoCompute(projectId: string) {
      await copyProjectFilesToCompute(storage, computer, projectId);
    },

    async dispose() {
      await computer.dispose();
      await db.dispose();
      if (storage.dispose) {
        await storage.dispose();
      }
    },
  };

  // Load sample project files into compute
  await ctx.loadProjectIntoCompute(SAMPLE_PROJECT_ID);

  return ctx;
}

/**
 * Bootstrap the sample project if it doesn't exist
 */
async function bootstrapSampleProject(
  db: DatabaseProvider,
  storage: StorageProvider
): Promise<void> {
  // Check if sample project exists in DB
  const existing = await db.projects.findById(SAMPLE_PROJECT_ID);
  if (existing) {
    return;
  }

  console.log("[Context] Creating sample project...");

  // Create sample project in DB
  await db.projects.create({
    id: SAMPLE_PROJECT_ID,
    description: "A sample BIM project with IFC files for demonstration",
  });

  // Upload sample files to storage
  const projectPrefix = `projects/${SAMPLE_PROJECT_ID}`;

  try {
    const ifcContent = await readFile(SAMPLE_IFC_PATH);
    await storage.put(`${projectPrefix}/sample.ifc`, new Uint8Array(ifcContent), {
      contentType: "application/x-step",
    });
    console.log("[Context] Uploaded sample.ifc to storage");
  } catch (err) {
    console.warn("[Context] Could not upload sample.ifc:", err);
  }

  try {
    const pyContent = await readFile(SAMPLE_PY_SCRIPT_PATH);
    await storage.put(`${projectPrefix}/print_info.py`, new Uint8Array(pyContent), {
      contentType: "text/x-python",
    });
    console.log("[Context] Uploaded print_info.py to storage");
  } catch (err) {
    console.warn("[Context] Could not upload print_info.py:", err);
  }

  await storage.put(
    `${projectPrefix}/README.md`,
    "# Sample Project\n\nWelcome to the Sample BIM Project!\n\nThis project contains sample IFC files for demonstration.\n",
    { contentType: "text/markdown" }
  );

  console.log("[Context] Sample project created successfully");
}

/**
 * Copy all project files from storage to compute working directory
 */
async function copyProjectFilesToCompute(
  storage: StorageProvider,
  computer: Computer,
  projectId: string
): Promise<void> {
  const projectPrefix = `projects/${projectId}/`;

  // List all files in project storage
  for await (const entry of storage.list(projectPrefix)) {
    // Get relative path (remove project prefix)
    const relativePath = entry.key.slice(projectPrefix.length);
    if (!relativePath) continue;

    // Get file content from storage
    const obj = await storage.get(entry.key);
    if (!obj) continue;

    // Ensure parent directory exists in compute
    const parentDir = dirname(relativePath);
    if (parentDir && parentDir !== ".") {
      try {
        await computer.files.mkdir(parentDir, { recursive: true });
      } catch {
        // Directory might already exist
      }
    }

    // Write file to compute
    await computer.files.write(relativePath, obj.data);
  }
}
