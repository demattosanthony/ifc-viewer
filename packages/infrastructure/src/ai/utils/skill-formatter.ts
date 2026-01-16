/**
 * Skill Formatter
 *
 * Formats skill metadata for injection into the system prompt.
 * Follows the Agent Skills spec: https://agentskills.io
 *
 * Only metadata is injected - the model reads full SKILL.md content on-demand.
 */

import type { SkillMetadata } from "@ifc-viewer/core"
import { SKILLS_PATH } from "../../skills/constants.ts"

/**
 * Format skill metadata into XML for system prompt injection.
 * The model can then read the full skill by accessing the path.
 *
 * Example output:
 * ```xml
 * <available_skills path="/opt/skills">
 *   <skill>
 *     <name>pdf</name>
 *     <description>Extract text and tables from PDF files...</description>
 *     <location>/opt/skills/pdf/SKILL.md</location>
 *   </skill>
 * </available_skills>
 * ```
 */
export function formatSkillsForPrompt(skills: SkillMetadata[]): string {
  if (skills.length === 0) {
    return ""
  }

  const skillEntries = skills
    .map(
      (skill) => `  <skill>
    <name>${escapeXml(skill.name)}</name>
    <description>${escapeXml(skill.description)}</description>
    <location>${escapeXml(skill.path)}/SKILL.md</location>
  </skill>`
    )
    .join("\n")

  return `<available_skills path="${SKILLS_PATH}">
${skillEntries}
</available_skills>

Skills are installed at ${SKILLS_PATH}. When a task matches a skill's description, read the skill's SKILL.md file to get detailed instructions. The skill directory may also contain scripts/, references/, and other resources you can use.`
}

/** Escape special XML characters */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
