import { mkdir, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { type Computer, type Context, createContext, uploadModel } from "@ifc-viewer/core"
import {
  createAIProviderFromEnv,
  createDatabase,
  createDockerComputer,
  createLocalComputer,
  createMemoryStreamStore,
  createStorage,
  type DatabaseConfig,
} from "@ifc-viewer/infrastructure"
import { createLogger } from "@ifc-viewer/logger"

const log = createLogger("context")

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const MONOREPO_ROOT = resolve(__dirname, "..", "..", "..")
const SAMPLE_PROJECT_ID = "sample-project"
const SAMPLE_IFC_PATH = resolve(__dirname, "..", "assets", "sample.ifc")
const SAMPLE_PY_SCRIPT_PATH = resolve(__dirname, "..", "assets", "print_info.py")
const DEFAULT_DOCKER_IMAGE = "bim-ide:latest"

export type ComputeProvider = "local" | "docker"

export type AppContextConfig = {
  /** Directory for local compute workspaces (only used when computeProvider is "local") */
  localWorkspacesDir?: string
  dataDirectory?: string
  storageDirectory?: string
  databaseUrl?: string
  computeProvider?: ComputeProvider
  dockerImage?: string
}

function getDatabaseConfig(config: AppContextConfig): DatabaseConfig {
  const databaseUrl = config.databaseUrl ?? process.env.DATABASE_URL
  if (databaseUrl) {
    return { type: "postgres", connectionString: databaseUrl }
  }
  const dataDirectory =
    config.dataDirectory ?? process.env.DATA_DIR ?? resolve(MONOREPO_ROOT, ".data", "sqlite")
  return { type: "sqlite", dataDirectory }
}

export async function createAppContext(config: AppContextConfig = {}): Promise<Context> {
  const storageDirectory =
    config.storageDirectory ??
    process.env.STORAGE_LOCAL_BASE_DIR ??
    resolve(MONOREPO_ROOT, ".data", "storage")
  const computeProvider: ComputeProvider =
    config.computeProvider ??
    (process.env.COMPUTE_PROVIDER as ComputeProvider | undefined) ??
    "docker"
  const dockerImage = config.dockerImage ?? process.env.DOCKER_IMAGE

  await mkdir(storageDirectory, { recursive: true })

  const dbConfig = getDatabaseConfig(config)
  if (dbConfig.type === "sqlite") {
    await mkdir(dbConfig.dataDirectory, { recursive: true })
  }

  log.info("Initializing context", { computeProvider })

  const db = await createDatabase(dbConfig)
  const storage = createStorage({ type: "local", baseDir: storageDirectory })
  const ai = createAIProviderFromEnv()
  const streams = createMemoryStreamStore({ ttlMs: 30 * 60 * 1000 }) // 30 minutes

  // Local compute needs a host directory for workspaces
  const localWorkspacesDir =
    config.localWorkspacesDir ??
    process.env.WORKSPACES_DIR ??
    resolve(MONOREPO_ROOT, ".data", "workspaces")
  if (computeProvider === "local") {
    await mkdir(localWorkspacesDir, { recursive: true })
  }

  const ctx = createContext({
    db,
    storage,
    ai,
    streams,

    async computeFactory(projectId: string): Promise<Computer> {
      if (computeProvider === "docker") {
        return createDockerComputer({ image: dockerImage ?? DEFAULT_DOCKER_IMAGE })
      }

      const workingDirectory = `${localWorkspacesDir}/project-${projectId}`
      await mkdir(workingDirectory, { recursive: true })
      return createLocalComputer({ workingDirectory, cleanup: false })
    },
  })

  await bootstrapSampleProject(ctx)
  return ctx
}

async function bootstrapSampleProject(ctx: Context): Promise<void> {
  if (await ctx.db.projects.findById(SAMPLE_PROJECT_ID)) return

  log.info("Creating sample project")
  await ctx.db.projects.create({
    id: SAMPLE_PROJECT_ID,
    description: "A sample BIM project with IFC files for demonstration",
  })

  const prefix = `projects/${SAMPLE_PROJECT_ID}`

  // Upload sample IFC model via Models API
  try {
    const ifcData = new Uint8Array(await readFile(SAMPLE_IFC_PATH))
    await uploadModel(ctx, {
      projectId: SAMPLE_PROJECT_ID,
      name: "Sample Model",
      fileName: "sample.ifc",
      data: ifcData,
    })
    log.info("Uploaded sample model")
  } catch (err) {
    log.warn("Could not upload sample model", { error: err })
  }

  // Upload sample Python script (regular file, not a model)
  try {
    const pyData = new Uint8Array(await readFile(SAMPLE_PY_SCRIPT_PATH))
    await ctx.storage.put(`${prefix}/scripts/print_info.py`, pyData, {
      contentType: "text/x-python",
    })
  } catch {}

  // Upload README
  await ctx.storage.put(
    `${prefix}/README.md`,
    "# Sample Project\n\nA sample BIM project with IFC models for demonstration.\n\n## Structure\n\n- `models/` - IFC model files\n- `scripts/` - Python scripts for analysis\n",
    { contentType: "text/markdown" }
  )

  log.info("Sample project created")
}
