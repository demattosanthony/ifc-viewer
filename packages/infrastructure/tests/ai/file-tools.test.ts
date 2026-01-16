/**
 * File Tools Tests
 *
 * Tests for the file tools utilities.
 */

import { describe, expect, test } from "bun:test"
import { isSkillsPath } from "../../src/ai/tools/file-tools.ts"

describe("isSkillsPath", () => {
  test("returns true for skill file paths", () => {
    expect(isSkillsPath("/opt/skills/pdf/SKILL.md")).toBe(true)
    expect(isSkillsPath("/opt/skills/data-analysis/scripts/run.py")).toBe(true)
    expect(isSkillsPath("/opt/skills/test/nested/deep/file.txt")).toBe(true)
  })

  test("returns true for skills root directory", () => {
    expect(isSkillsPath("/opt/skills")).toBe(true)
  })

  test("returns true for paths starting with /opt/skills/", () => {
    expect(isSkillsPath("/opt/skills/")).toBe(true)
    expect(isSkillsPath("/opt/skills/anything")).toBe(true)
  })

  test("returns false for workspace paths", () => {
    expect(isSkillsPath("/workspace/file.txt")).toBe(false)
    expect(isSkillsPath("/workspace/src/index.ts")).toBe(false)
  })

  test("returns false for other /opt paths", () => {
    expect(isSkillsPath("/opt/other/file.txt")).toBe(false)
    expect(isSkillsPath("/opt/skillsxyz/file.txt")).toBe(false)
  })

  test("returns false for similar but different paths", () => {
    expect(isSkillsPath("/home/opt/skills/file.txt")).toBe(false)
    expect(isSkillsPath("/var/opt/skills/file.txt")).toBe(false)
    expect(isSkillsPath("opt/skills/file.txt")).toBe(false)
  })

  test("returns false for root and home paths", () => {
    expect(isSkillsPath("/")).toBe(false)
    expect(isSkillsPath("/home/user/file.txt")).toBe(false)
    expect(isSkillsPath("./relative/path.txt")).toBe(false)
  })
})
