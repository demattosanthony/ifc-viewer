import {
  createDatabase,
  createStorage,
  createLocalComputer,
  createDockerComputer,
  createAIProviderFromEnv,
  type DatabaseConfig,
} from "@ifc-viewer/infrastructure"
import { createContext, type Context, type Computer } from "@ifc-viewer/core"
import { mkdir, readFile } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const MONOREPO_ROOT = resolve(__dirname, "..", "..", "..")

const SAMPLE_PROJECT_ID = "sample-project"
const SAMPLE_IFC_PATH = resolve(__dirname, "..", "assets", "sample.ifc")
const SAMPLE_PY_SCRIPT_PATH = resolve(__dirname, "..", "assets", "print_info.py")

const DEFAULT_DOCKER_IMAGE = "bim-ide:latest"

export type ComputeProvider = "local" | "docker"

export type AppContextConfig = {
  workingDirectory?: string
  dataDirectory?: string
  storageDirectory?: string
  databaseUrl?: string
  /** Compute provider to use: "local" or "docker" (default: from COMPUTE_PROVIDER env or "docker") */
  computeProvider?: ComputeProvider
  /** Docker image to use when computeProvider is "docker" */
  dockerImage?: string
}

function getDatabaseConfig(config: AppContextConfig): DatabaseConfig {
  const databaseUrl = config.databaseUrl ?? process.env.DATABASE_URL

  if (databaseUrl) {
    return { type: "postgres", connectionString: databaseUrl }
  }

  const dataDirectory =
    config.dataDirectory ??
    process.env.DATA_DIR ??
    resolve(MONOREPO_ROOT, ".data", "sqlite")

  return { type: "sqlite", dataDirectory }
}

/**
 * Create compute provider based on configuration
 */
async function createCompute(
  provider: ComputeProvider,
  workingDirectory: string,
  dockerImage?: string
): Promise<Computer> {
  if (provider === "docker") {
    console.log(`[Context] Using Docker compute provider (image: ${dockerImage ?? DEFAULT_DOCKER_IMAGE})`)
    return createDockerComputer({
      workingDirectory,
      image: dockerImage ?? DEFAULT_DOCKER_IMAGE,
      cleanup: true, // Remove container on dispose
    })
  }

  console.log("[Context] Using local compute provider")
  return createLocalComputer({ workingDirectory, cleanup: false })
}

export async function createAppContext(config: AppContextConfig = {}): Promise<Context> {
  const workingDirectory =
    config.workingDirectory ??
    process.env.PLAYGROUND_WORKING_DIR ??
    resolve(MONOREPO_ROOT, ".data", "workspace")

  const storageDirectory =
    config.storageDirectory ??
    process.env.STORAGE_LOCAL_BASE_DIR ??
    resolve(MONOREPO_ROOT, ".data", "storage")

  // Determine compute provider from config or environment
  const computeProvider: ComputeProvider =
    config.computeProvider ??
    (process.env.COMPUTE_PROVIDER as ComputeProvider | undefined) ??
    "docker"

  const dockerImage = config.dockerImage ?? process.env.DOCKER_IMAGE

  await mkdir(workingDirectory, { recursive: true })
  await mkdir(storageDirectory, { recursive: true })

  const dbConfig = getDatabaseConfig(config)
  if (dbConfig.type === "sqlite") {
    await mkdir(dbConfig.dataDirectory, { recursive: true })
  }

  const db = await createDatabase(dbConfig)
  const storage = createStorage({ type: "local", baseDir: storageDirectory })
  const compute = await createCompute(computeProvider, workingDirectory, dockerImage)
  const ai = createAIProviderFromEnv()

  const ctx = createContext({ db, storage, compute, ai })

  // Bootstrap sample project
  await bootstrapSampleProject(ctx)

  return ctx
}

async function bootstrapSampleProject(ctx: Context): Promise<void> {
  const existing = await ctx.db.projects.findById(SAMPLE_PROJECT_ID)
  if (existing) {
    // Load existing project files into compute
    await loadProjectFiles(ctx, SAMPLE_PROJECT_ID)
    return
  }

  console.log("[Context] Creating sample project...")

  await ctx.db.projects.create({
    id: SAMPLE_PROJECT_ID,
    description: "A sample BIM project with IFC files for demonstration",
  })

  const prefix = `projects/${SAMPLE_PROJECT_ID}`

  try {
    const ifcContent = await readFile(SAMPLE_IFC_PATH)
    await ctx.storage.put(`${prefix}/sample.ifc`, new Uint8Array(ifcContent), {
      contentType: "application/x-step",
    })
    console.log("[Context] Uploaded sample.ifc to storage")
  } catch (err) {
    console.warn("[Context] Could not upload sample.ifc:", err)
  }

  try {
    const pyContent = await readFile(SAMPLE_PY_SCRIPT_PATH)
    await ctx.storage.put(`${prefix}/print_info.py`, new Uint8Array(pyContent), {
      contentType: "text/x-python",
    })
    console.log("[Context] Uploaded print_info.py to storage")
  } catch (err) {
    console.warn("[Context] Could not upload print_info.py:", err)
  }

  await ctx.storage.put(
    `${prefix}/README.md`,
    "# Sample Project\n\nWelcome to the Sample BIM Project!\n\nThis project contains sample IFC files for demonstration.\n",
    { contentType: "text/markdown" }
  )

  console.log("[Context] Sample project created successfully")

  // Load into compute
  await loadProjectFiles(ctx, SAMPLE_PROJECT_ID)
}

async function loadProjectFiles(ctx: Context, projectId: string): Promise<void> {
  const prefix = `projects/${projectId}/`

  for await (const entry of ctx.storage.list(prefix)) {
    const relativePath = entry.key.slice(prefix.length)
    if (!relativePath) continue

    const obj = await ctx.storage.get(entry.key)
    if (!obj) continue

    const parentDir = relativePath.includes("/")
      ? relativePath.slice(0, relativePath.lastIndexOf("/"))
      : null

    if (parentDir) {
      try {
        await ctx.compute.files.mkdir(parentDir, { recursive: true })
      } catch {
        // Directory might already exist
      }
    }

    await ctx.compute.files.write(relativePath, obj.data)
  }
}
