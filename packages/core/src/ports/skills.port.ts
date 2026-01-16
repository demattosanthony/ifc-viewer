/**
 * Skills Port
 *
 * Defines the interface for loading agent skills following the Agent Skills spec.
 * See: https://agentskills.io
 *
 * Skills are discovered at startup (metadata only), then activated on-demand
 * when the model reads the full SKILL.md file.
 */

import type { Computer } from "./compute.port"

// ============================================================================
// Skill Types
// ============================================================================

/**
 * Skill metadata - loaded at startup for all skills.
 * This is injected into the system prompt so the model knows what's available.
 */
export interface SkillMetadata {
  /** Unique identifier matching directory name (e.g., "pdf", "data-analysis") */
  readonly name: string
  /** Description of what the skill does and when to use it */
  readonly description: string
  /** Absolute path to the skill directory in the compute environment */
  readonly path: string
}

// ============================================================================
// Skills Provider
// ============================================================================

/** Configuration for skills provider */
export interface SkillsProviderConfig {
  /** Path to bundled skills directory on the server */
  bundledSkillsPath?: string
}

/** Skills provider interface */
export interface SkillsProvider {
  readonly type: string

  /** Path to bundled skills directory */
  readonly bundledSkillsPath: string

  /**
   * Discover all available skills and return their metadata.
   * Only parses frontmatter (name + description), not full content.
   */
  discoverSkills(): Promise<SkillMetadata[]>

  /**
   * Copy bundled skills into a compute environment.
   * Called when compute is created so the model can access skills via filesystem.
   * @param computer - The compute environment to copy skills into
   * @param destPath - Destination path in the compute environment
   */
  copyBundledSkillsToCompute(computer: Computer, destPath: string): Promise<void>
}
