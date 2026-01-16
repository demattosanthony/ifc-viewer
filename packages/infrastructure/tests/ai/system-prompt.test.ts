/**
 * System Prompt Tests
 *
 * Tests for the system prompt builder.
 */

import { describe, expect, test } from "bun:test"
import { BIM_IDE_SYSTEM_PROMPT, buildSystemPrompt } from "../../src/ai/prompts/system-prompt.ts"

describe("buildSystemPrompt", () => {
  test("returns default prompt when no options provided", () => {
    const result = buildSystemPrompt()

    expect(result).toBe(BIM_IDE_SYSTEM_PROMPT)
  })

  test("returns default prompt with empty skills array", () => {
    const result = buildSystemPrompt({ skills: [] })

    expect(result).toBe(BIM_IDE_SYSTEM_PROMPT)
  })

  test("appends skills section when skills provided", () => {
    const skills = [
      {
        name: "pdf",
        description: "Extract text from PDF files",
        path: "/opt/skills/pdf",
      },
    ]

    const result = buildSystemPrompt({ skills })

    expect(result).toContain(BIM_IDE_SYSTEM_PROMPT)
    expect(result).toContain("<available_skills")
    expect(result).toContain("<name>pdf</name>")
    expect(result).toContain("Extract text from PDF files")
  })

  test("uses custom base prompt when provided", () => {
    const customPrompt = "You are a custom assistant."

    const result = buildSystemPrompt({ basePrompt: customPrompt })

    expect(result).toBe(customPrompt)
    expect(result).not.toContain(BIM_IDE_SYSTEM_PROMPT)
  })

  test("combines custom base prompt with skills", () => {
    const customPrompt = "You are a custom assistant."
    const skills = [
      {
        name: "test",
        description: "Test skill",
        path: "/opt/skills/test",
      },
    ]

    const result = buildSystemPrompt({ basePrompt: customPrompt, skills })

    expect(result).toContain(customPrompt)
    expect(result).toContain("<available_skills")
    expect(result).toContain("<name>test</name>")
  })

  test("skills section comes after base prompt", () => {
    const skills = [
      {
        name: "pdf",
        description: "PDF skill",
        path: "/opt/skills/pdf",
      },
    ]

    const result = buildSystemPrompt({ skills })

    const basePromptEnd = result.indexOf("complex automation workflows.")
    const skillsStart = result.indexOf("<available_skills")

    expect(skillsStart).toBeGreaterThan(basePromptEnd)
  })
})
