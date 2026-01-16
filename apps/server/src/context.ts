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
  createSkillsProvider,
  createStorage,
  createThatOpenIFCProcessor,
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
const BUNDLED_SKILLS_PATH = resolve(
  MONOREPO_ROOT,
  "packages",
  "infrastructure",
  "src",
  "skills",
  "bundled"
)

export type ComputeProvider = "local" | "docker"
export type AppContextMode = "server" | "offline"

export async function createAppContext(mode: AppContextMode = "server"): Promise<Context> {
  const isOffline = mode === "offline"
  const computeProvider: ComputeProvider = isOffline
    ? "local"
    : ((process.env.COMPUTE_PROVIDER as ComputeProvider | undefined) ?? "docker")
  const dockerImage = process.env.DOCKER_IMAGE

  const dbConfig: DatabaseConfig = isOffline
    ? { type: "memory" }
    : (() => {
        const databaseUrl = process.env.DATABASE_URL
        if (databaseUrl) {
          return { type: "postgres", connectionString: databaseUrl }
        }
        const dataDirectory = process.env.DATA_DIR ?? resolve(MONOREPO_ROOT, ".data", "sqlite")
        return { type: "sqlite", dataDirectory }
      })()

  if (dbConfig.type === "sqlite") {
    await mkdir(dbConfig.dataDirectory, { recursive: true })
  }

  const storageDirectory =
    process.env.STORAGE_LOCAL_BASE_DIR ?? resolve(MONOREPO_ROOT, ".data", "storage")
  const storage = isOffline
    ? createStorage({ type: "memory" })
    : createStorage({ type: "local", baseDir: storageDirectory })

  log.info("Initializing context", { computeProvider })

  const db = await createDatabase(dbConfig)
  const ai = createAIProviderFromEnv()
  const streams = createMemoryStreamStore({ ttlMs: 30 * 60 * 1000 }) // 30 minutes

  const localWorkspacesDir =
    process.env.WORKSPACES_DIR ?? resolve(MONOREPO_ROOT, ".data", "workspaces")

  const ifcProcessor = createThatOpenIFCProcessor()
  const skills = createSkillsProvider({
    type: "filesystem",
    bundledSkillsPath: BUNDLED_SKILLS_PATH,
  })

  const ctx = createContext({
    db,
    storage,
    ai,
    streams,
    ifcProcessor,
    skills,

    async computeFactory(projectId: string): Promise<Computer> {
      if (computeProvider === "docker") {
        return createDockerComputer({ image: dockerImage ?? DEFAULT_DOCKER_IMAGE, memory: "1g" })
      }

      const workingDirectory = `${localWorkspacesDir}/project-${projectId}`
      await mkdir(workingDirectory, { recursive: true })
      return createLocalComputer({ workingDirectory, cleanup: false })
    },
  })

  if (!isOffline) {
    await bootstrapSampleProject(ctx)
  }

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
    const fileName = "sample.ifc"

    // Convert IFC to fragments for instant rendering
    let fragmentData: Uint8Array | undefined
    let fragmentPath: string | undefined
    let fragmentVersion: string | undefined

    try {
      fragmentData = await ctx.ifcProcessor.convert(ifcData)
      fragmentPath = ctx.ifcProcessor.getFragmentPath(`models/${fileName}`)
      fragmentVersion = ctx.ifcProcessor.version
      log.debug("Sample model fragment conversion succeeded", {
        fragmentSize: fragmentData.byteLength,
      })
    } catch (conversionError) {
      // Log but don't fail - client can still convert on-the-fly
      log.warn("Sample model fragment conversion failed, client will convert on-the-fly", {
        error: conversionError,
      })
    }

    await uploadModel(ctx, {
      projectId: SAMPLE_PROJECT_ID,
      name: "Sample Model",
      fileName,
      data: ifcData,
      fragmentData,
      fragmentPath,
      fragmentVersion,
    })
    log.info("Uploaded sample model", { hasFragment: !!fragmentPath })
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
