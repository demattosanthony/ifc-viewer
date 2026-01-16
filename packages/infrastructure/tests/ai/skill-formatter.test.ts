/**
 * Skill Formatter Tests
 *
 * Tests for the skill formatting utility.
 */

import { describe, expect, test } from "bun:test"
import { formatSkillsForPrompt } from "../../src/ai/utils/skill-formatter.ts"

describe("formatSkillsForPrompt", () => {
  test("formats single skill as XML", () => {
    const skills = [
      {
        name: "test-skill",
        description: "This is a test skill",
        path: "/opt/skills/test-skill",
      },
    ]

    const result = formatSkillsForPrompt(skills)

    expect(result).toContain('<available_skills path="/opt/skills">')
    expect(result).toContain("<name>test-skill</name>")
    expect(result).toContain("<description>This is a test skill</description>")
    expect(result).toContain("<location>/opt/skills/test-skill/SKILL.md</location>")
    expect(result).toContain("</available_skills>")
    expect(result).toContain("Skills are installed at /opt/skills")
  })

  test("formats multiple skills", () => {
    const skills = [
      { name: "skill-1", description: "First skill", path: "/opt/skills/skill-1" },
      { name: "skill-2", description: "Second skill", path: "/opt/skills/skill-2" },
    ]

    const result = formatSkillsForPrompt(skills)

    expect(result).toContain("<name>skill-1</name>")
    expect(result).toContain("<name>skill-2</name>")
  })

  test("returns empty string for no skills", () => {
    const result = formatSkillsForPrompt([])
    expect(result).toBe("")
  })

  test("includes instruction to read SKILL.md", () => {
    const skills = [
      {
        name: "test",
        description: "Test skill",
        path: "/opt/skills/test",
      },
    ]

    const result = formatSkillsForPrompt(skills)

    expect(result).toContain("read the skill's SKILL.md file")
  })

  test("escapes XML special characters", () => {
    const skills = [
      {
        name: "xml-test",
        description: 'Handles <special> & "characters"',
        path: "/opt/skills/xml-test",
      },
    ]

    const result = formatSkillsForPrompt(skills)

    expect(result).toContain("&lt;special&gt;")
    expect(result).toContain("&amp;")
    expect(result).toContain("&quot;characters&quot;")
  })

  test("skills each have their own skill element", () => {
    const skills = [
      { name: "a", description: "A skill", path: "/path/a" },
      { name: "b", description: "B skill", path: "/path/b" },
    ]

    const result = formatSkillsForPrompt(skills)

    // Count skill elements
    const skillTags = result.match(/<skill>/g)
    expect(skillTags?.length).toBe(2)
  })
})
