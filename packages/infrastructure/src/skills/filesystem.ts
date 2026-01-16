/**
 * FileSystem Skills Provider
 *
 * Implements the Agent Skills spec for filesystem-based agents.
 * See: https://agentskills.io
 *
 * - Bundled skills: Shipped with the server, copied into compute on startup
 * - Workspace skills: User-provided in .skills/ directory
 *
 * Only metadata (name, description) is loaded at startup.
 * Full skill content is read by the model on-demand via shell commands.
 */

import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import type {
  Computer,
  SkillMetadata,
  SkillsProvider,
  SkillsProviderConfig,
} from "@ifc-viewer/core"
import { createLogger } from "@ifc-viewer/logger"
import { SKILL_FILENAME, SKILLS_PATH } from "./constants.ts"

const log = createLogger("skills")

// ============================================================================
// Types
// ============================================================================

/** Supported skills provider types */
export type SkillsProviderType = "filesystem"

/** Configuration for creating a skills provider */
export interface SkillsConfig extends SkillsProviderConfig {
  type: SkillsProviderType
}

export class FileSystemSkillsProvider implements SkillsProvider {
  readonly type = "filesystem"
  readonly bundledSkillsPath: string
  private metadataCache: SkillMetadata[] | null = null

  constructor(config: SkillsProviderConfig) {
    if (!config.bundledSkillsPath) {
      throw new Error("bundledSkillsPath is required for FileSystemSkillsProvider")
    }
    this.bundledSkillsPath = config.bundledSkillsPath
  }

  /**
   * Parse YAML frontmatter from a SKILL.md file to extract name and description.
   */
  private parseSkillFrontmatter(content: string): { name: string; description: string } | null {
    // Check for YAML frontmatter (starts with ---)
    if (!content.startsWith("---")) {
      return null
    }

    // Find closing ---
    const endIndex = content.indexOf("---", 3)
    if (endIndex === -1) {
      return null
    }

    const frontmatter = content.slice(3, endIndex).trim()

    // Simple YAML parsing for name and description
    let name: string | undefined
    let description: string | undefined

    for (const line of frontmatter.split("\n")) {
      const colonIndex = line.indexOf(":")
      if (colonIndex === -1) continue

      const key = line.slice(0, colonIndex).trim()
      let value = line.slice(colonIndex + 1).trim()

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      if (key === "name") {
        name = value
      } else if (key === "description") {
        description = value
      }
    }

    if (!name || !description) {
      return null
    }

    return { name, description }
  }

  /**
   * Discover bundled skills and return their metadata.
   * Skills will be available at BUNDLED_SKILLS_DEST/<skill-name>/ in the compute environment.
   *
   * TODO: Add workspace skills support - user-provided skills in .skills/ directory
   */
  async discoverSkills(): Promise<SkillMetadata[]> {
    // Return cached if available
    if (this.metadataCache) {
      return this.metadataCache
    }

    const skills: SkillMetadata[] = []

    // Load bundled skills
    try {
      const entries = await readdir(this.bundledSkillsPath, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const skillId = entry.name

        const skillFilePath = join(this.bundledSkillsPath, skillId, SKILL_FILENAME)

        try {
          const content = await readFile(skillFilePath, "utf-8")
          const frontmatter = this.parseSkillFrontmatter(content)

          if (frontmatter) {
            // Path where this skill will be in the compute environment
            const computePath = `${SKILLS_PATH}/${skillId}`

            skills.push({
              name: frontmatter.name,
              description: frontmatter.description,
              path: computePath,
            })
            log.debug("Discovered bundled skill", { name: frontmatter.name, path: computePath })
          }
        } catch {
          // SKILL.md doesn't exist in this directory, skip
        }
      }
    } catch (err) {
      log.warn("Could not read bundled skills directory", {
        path: this.bundledSkillsPath,
        error: err,
      })
    }

    this.metadataCache = skills
    log.info("Discovered skills", { count: skills.length })
    return skills
  }

  /**
   * Copy all bundled skills into the compute environment.
   * This makes skills accessible to the model via filesystem commands.
   * Skills are written to /opt/skills which is in the filesystem allowlist.
   */
  async copyBundledSkillsToCompute(
    computer: Computer,
    destPath: string = SKILLS_PATH
  ): Promise<void> {
    try {
      // Create destination directory (absolute path, allowed by filesystem)
      await computer.files.mkdir(destPath, { recursive: true })

      const entries = await readdir(this.bundledSkillsPath, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const skillId = entry.name
        const srcSkillDir = join(this.bundledSkillsPath, skillId)
        const destSkillDir = `${destPath}/${skillId}`

        // Create skill directory in compute
        await computer.files.mkdir(destSkillDir, { recursive: true })

        // Copy all files recursively
        await this.copyDirectoryToCompute(computer, srcSkillDir, destSkillDir)

        log.debug("Copied skill to compute", { skill: skillId, dest: destSkillDir })
      }

      log.info("Copied bundled skills to compute", { dest: destPath })
    } catch (err) {
      log.error("Failed to copy bundled skills to compute", { error: err })
      throw err
    }
  }

  /**
   * Recursively copy a directory from the server to the compute environment.
   */
  private async copyDirectoryToCompute(
    computer: Computer,
    srcDir: string,
    destDir: string
  ): Promise<void> {
    const entries = await readdir(srcDir, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = join(srcDir, entry.name)
      const destPath = `${destDir}/${entry.name}`

      if (entry.isDirectory()) {
        await computer.files.mkdir(destPath, { recursive: true })
        await this.copyDirectoryToCompute(computer, srcPath, destPath)
      } else if (entry.isFile()) {
        const content = await readFile(srcPath)
        await computer.files.write(destPath, new Uint8Array(content))
      }
    }
  }
}

/** Factory function to create a FileSystem skills provider */
export function createFileSystemSkillsProvider(config: SkillsProviderConfig): SkillsProvider {
  return new FileSystemSkillsProvider(config)
}

/** Create a skills provider based on configuration (currently only filesystem is supported) */
export function createSkillsProvider(config: SkillsConfig): SkillsProvider {
  // Currently only filesystem provider is supported
  // When more providers are added, this can dispatch based on config.type
  return createFileSystemSkillsProvider(config)
}
