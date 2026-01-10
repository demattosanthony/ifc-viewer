import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import type { LoggerConfig, LogLevel } from "./types.ts"

// Cache the monorepo root since it won't change during runtime
let cachedMonorepoRoot: string | null | undefined

/**
 * Find the monorepo root by walking up from cwd looking for package.json with workspaces.
 * Result is cached since the monorepo root won't change during process lifetime.
 */
function findMonorepoRoot(): string | null {
  if (cachedMonorepoRoot !== undefined) {
    return cachedMonorepoRoot
  }

  let dir = process.cwd()

  while (dir !== dirname(dir)) {
    const pkgPath = join(dir, "package.json")
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
        if (pkg.workspaces) {
          cachedMonorepoRoot = dir
          return dir
        }
      } catch {
        // Continue searching
      }
    }
    dir = dirname(dir)
  }

  cachedMonorepoRoot = null
  return null
}

/**
 * Resolve a path relative to the monorepo root (or cwd if not in a monorepo)
 */
function resolveFromRoot(relativePath: string): string {
  const root = findMonorepoRoot()
  return root ? join(root, relativePath) : resolve(process.cwd(), relativePath)
}

/**
 * Parse log level from string, defaulting to "info"
 */
function parseLogLevel(value: string | undefined): LogLevel {
  const level = value?.toLowerCase()
  if (level === "debug" || level === "info" || level === "warn" || level === "error") {
    return level
  }
  return "info"
}

/**
 * Parse boolean from string, with a default value
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue
  return value.toLowerCase() === "true" || value === "1"
}

/**
 * Get logger configuration from environment variables.
 *
 * Environment variables:
 * - LOG_LEVEL: debug | info | warn | error (default: info)
 * - LOG_DIR: Log directory path, resolved from monorepo root (default: .data/logs)
 * - LOG_TO_FILE: Enable file logging (default: true)
 * - LOG_TO_CONSOLE: Enable console logging (default: true)
 */
export function getConfig(): LoggerConfig {
  const logDirEnv = process.env.LOG_DIR ?? ".data/logs"

  // Absolute paths used as-is, relative paths resolved from monorepo root
  const logDir = logDirEnv.startsWith("/") ? logDirEnv : resolveFromRoot(logDirEnv)

  return {
    level: parseLogLevel(process.env.LOG_LEVEL),
    logDir,
    logToFile: parseBoolean(process.env.LOG_TO_FILE, true),
    logToConsole: parseBoolean(process.env.LOG_TO_CONSOLE, true),
  }
}
