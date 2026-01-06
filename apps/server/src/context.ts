import {
  createDatabase,
  createStorage,
  createLocalComputer,
  createDockerComputer,
  createAIProviderFromEnv,
  type DatabaseConfig,
} from "@ifc-viewer/infrastructure"
import { createContext, stopWorkspaceWithSync, type Context, type Computer, type ComputeFactory } from "@ifc-viewer/core"
import { createLogger } from "@ifc-viewer/logger"
import { mkdir, readFile } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

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
  workspacesDirectory?: string
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
 * Create a compute factory based on provider type
 */
function createComputeFactory(
  provider: ComputeProvider,
  dockerImage?: string
): ComputeFactory {
  return async (_workspaceId: string, workingDirectory: string): Promise<Computer> => {
    // Ensure workspace directory exists
    await mkdir(workingDirectory, { recursive: true })

    if (provider === "docker") {
      log.debug("Creating Docker compute", { image: dockerImage ?? DEFAULT_DOCKER_IMAGE })
      return createDockerComputer({
        workingDirectory,
        image: dockerImage ?? DEFAULT_DOCKER_IMAGE,
        cleanup: true,
      })
    }

    log.debug("Creating local compute")
    return createLocalComputer({ workingDirectory, cleanup: false })
  }
}

export async function createAppContext(config: AppContextConfig = {}): Promise<Context> {
  const workspacesDir =
    config.workspacesDirectory ??
    process.env.WORKSPACES_DIR ??
    resolve(MONOREPO_ROOT, ".data", "workspaces")

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

  await mkdir(workspacesDir, { recursive: true })
  await mkdir(storageDirectory, { recursive: true })

  const dbConfig = getDatabaseConfig(config)
  if (dbConfig.type === "sqlite") {
    await mkdir(dbConfig.dataDirectory, { recursive: true })
  }

  log.info("Initializing context", { computeProvider, workspacesDir })

  const db = await createDatabase(dbConfig)
  const storage = createStorage({ type: "local", baseDir: storageDirectory })
  const ai = createAIProviderFromEnv()
  const computeFactory = createComputeFactory(computeProvider, dockerImage)

  // Late-bound reference for the idle callback
  let ctxRef: Context | null = null

  const onWorkspaceIdle = async (workspaceId: string): Promise<void> => {
    if (!ctxRef) return
    log.info("Workspace idle, stopping", { workspaceId })
    try {
      await stopWorkspaceWithSync(ctxRef, workspaceId)
      log.info("Workspace stopped", { workspaceId })
    } catch (err) {
      log.error("Failed to stop workspace", { workspaceId, error: err })
    }
  }

  const ctx = createContext({
    db,
    storage,
    ai,
    workspacesDir,
    computeFactory,
    onWorkspaceIdle,
  })
  ctxRef = ctx

  // Bootstrap sample project
  await bootstrapSampleProject(ctx)

  return ctx
}

async function bootstrapSampleProject(ctx: Context): Promise<void> {
  const bootstrapLog = log.child("bootstrap")
  const existing = await ctx.db.projects.findById(SAMPLE_PROJECT_ID)
  if (existing) {
    bootstrapLog.debug("Sample project already exists")
    return
  }

  bootstrapLog.info("Creating sample project")

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
    bootstrapLog.debug("Uploaded sample.ifc")
  } catch (err) {
    bootstrapLog.warn("Could not upload sample.ifc", { error: err })
  }

  try {
    const pyContent = await readFile(SAMPLE_PY_SCRIPT_PATH)
    await ctx.storage.put(`${prefix}/print_info.py`, new Uint8Array(pyContent), {
      contentType: "text/x-python",
    })
    bootstrapLog.debug("Uploaded print_info.py")
  } catch (err) {
    bootstrapLog.warn("Could not upload print_info.py", { error: err })
  }

  await ctx.storage.put(
    `${prefix}/README.md`,
    "# Sample Project\n\nWelcome to the Sample BIM Project!\n\nThis project contains sample IFC files for demonstration.\n",
    { contentType: "text/markdown" }
  )

  bootstrapLog.info("Sample project created")
}
