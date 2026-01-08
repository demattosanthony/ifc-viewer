#!/usr/bin/env bun

/**
 * Development script that starts the database and dev servers,
 * and ensures the database container is stopped on exit (Ctrl+C).
 */

import { $ } from "bun"

async function startDb() {
  console.log("Starting database container...")
  // --wait ensures health check passes before returning
  await $`docker compose up -d postgres --wait`
  console.log("Database ready")
}

async function stopDb() {
  console.log("\nStopping database container...")
  await $`docker compose down`
}

async function startDevServers() {
  return Bun.spawn(
    [
      "bun",
      "run",
      "--env-file=.env",
      "--filter=@ifc-viewer/server",
      "--filter=@ifc-viewer/web",
      "dev",
    ],
    {
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    }
  )
}

async function main() {
  await startDb()

  const devProcess = await startDevServers()

  const cleanup = async () => {
    devProcess.kill()
    await stopDb()
    process.exit(0)
  }

  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)

  await devProcess.exited
  await stopDb()
}

main().catch(async (error) => {
  console.error("Error:", error)
  await stopDb()
  process.exit(1)
})
