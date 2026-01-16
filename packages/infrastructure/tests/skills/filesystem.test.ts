/**
 * FileSystemSkillsProvider Tests
 *
 * Tests for the filesystem-based skills provider implementation.
 */

import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"
import { createFileSystemSkillsProvider } from "../../src/skills/filesystem.ts"

const BUNDLED_SKILLS_PATH = resolve(import.meta.dirname, "../../src/skills/bundled")

describe("FileSystemSkillsProvider", () => {
  test("discovers bundled skills with metadata", async () => {
    const provider = createFileSystemSkillsProvider({
      bundledSkillsPath: BUNDLED_SKILLS_PATH,
    })

    const skills = await provider.discoverSkills()

    expect(skills.length).toBeGreaterThan(0)

    const pdfSkill = skills.find((s) => s.name === "pdf")
    expect(pdfSkill).toBeDefined()
    expect(pdfSkill?.description).toContain("PDF")
    expect(pdfSkill?.path).toContain("pdf")
  })

  test("caches discovered skills", async () => {
    const provider = createFileSystemSkillsProvider({
      bundledSkillsPath: BUNDLED_SKILLS_PATH,
    })

    const skills1 = await provider.discoverSkills()
    const skills2 = await provider.discoverSkills()

    expect(skills1).toBe(skills2) // Same reference (cached)
  })

  test("handles missing bundled skills directory gracefully", async () => {
    const provider = createFileSystemSkillsProvider({
      bundledSkillsPath: "/nonexistent/path",
    })

    const skills = await provider.discoverSkills()
    expect(skills).toEqual([])
  })

  test("throws error when bundledSkillsPath is not provided", () => {
    expect(() => {
      createFileSystemSkillsProvider({})
    }).toThrow("bundledSkillsPath is required for FileSystemSkillsProvider")
  })

  test("has correct type identifier", () => {
    const provider = createFileSystemSkillsProvider({
      bundledSkillsPath: BUNDLED_SKILLS_PATH,
    })

    expect(provider.type).toBe("filesystem")
  })

  test("exposes bundledSkillsPath", () => {
    const provider = createFileSystemSkillsProvider({
      bundledSkillsPath: BUNDLED_SKILLS_PATH,
    })

    expect(provider.bundledSkillsPath).toBe(BUNDLED_SKILLS_PATH)
  })

  test("parses YAML frontmatter correctly", async () => {
    const provider = createFileSystemSkillsProvider({
      bundledSkillsPath: BUNDLED_SKILLS_PATH,
    })

    const skills = await provider.discoverSkills()
    const pdfSkill = skills.find((s) => s.name === "pdf")

    // Should have name and description from frontmatter
    expect(pdfSkill?.name).toBe("pdf")
    expect(pdfSkill?.description.length).toBeGreaterThan(10)
  })

  test("skill paths point to bundled skills location", async () => {
    const provider = createFileSystemSkillsProvider({
      bundledSkillsPath: BUNDLED_SKILLS_PATH,
    })

    const skills = await provider.discoverSkills()

    for (const skill of skills) {
      expect(skill.path).toMatch(/^\/opt\/skills\//)
    }
  })
})
