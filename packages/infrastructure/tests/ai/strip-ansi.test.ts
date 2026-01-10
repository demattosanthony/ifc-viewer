/**
 * Strip ANSI Tests
 *
 * Tests for the ANSI escape code stripping utility.
 * These patterns come from real terminal output that was rendering incorrectly.
 */

import { describe, test, expect } from "bun:test"
import { stripAnsi } from "../../src/ai/utils"

describe("stripAnsi", () => {
  describe("color codes", () => {
    test("strips basic color codes", () => {
      const input = "\x1b[36m/workspace\x1b[0m $ ls"
      expect(stripAnsi(input)).toBe("/workspace $ ls")
    })

    test("strips bold color codes", () => {
      const input = "\x1b[01;34mdir\x1b[0m"
      expect(stripAnsi(input)).toBe("dir")
    })

    test("strips multiple color codes in sequence", () => {
      const input = "\x1b[0m\x1b[01;34m.\x1b[0m"
      expect(stripAnsi(input)).toBe(".")
    })

    test("strips 256-color codes", () => {
      const input = "\x1b[38;5;82mgreen\x1b[0m"
      expect(stripAnsi(input)).toBe("green")
    })

    test("strips RGB color codes", () => {
      const input = "\x1b[38;2;255;100;50mrgb\x1b[0m"
      expect(stripAnsi(input)).toBe("rgb")
    })
  })

  describe("terminal modes", () => {
    test("strips bracket paste mode enable", () => {
      const input = "\x1b[?2004hcommand output"
      expect(stripAnsi(input)).toBe("command output")
    })

    test("strips bracket paste mode disable", () => {
      const input = "\x1b[?2004lcommand output"
      expect(stripAnsi(input)).toBe("command output")
    })

    test("strips cursor visibility codes", () => {
      const input = "\x1b[?25hvisible\x1b[?25l"
      expect(stripAnsi(input)).toBe("visible")
    })
  })

  describe("cursor movement", () => {
    test("strips cursor up", () => {
      const input = "\x1b[2Atext"
      expect(stripAnsi(input)).toBe("text")
    })

    test("strips cursor position", () => {
      const input = "\x1b[10;20Htext"
      expect(stripAnsi(input)).toBe("text")
    })

    test("strips erase line", () => {
      const input = "\x1b[2Ktext"
      expect(stripAnsi(input)).toBe("text")
    })
  })

  describe("control characters", () => {
    test("strips carriage return", () => {
      const input = "line1\rline2"
      expect(stripAnsi(input)).toBe("line1line2")
    })

    test("preserves newlines", () => {
      const input = "line1\nline2"
      expect(stripAnsi(input)).toBe("line1\nline2")
    })

    test("preserves tabs", () => {
      const input = "col1\tcol2"
      expect(stripAnsi(input)).toBe("col1\tcol2")
    })

    test("strips null bytes", () => {
      const input = "text\x00more"
      expect(stripAnsi(input)).toBe("textmore")
    })
  })

  describe("real terminal output", () => {
    test("cleans ls -la output with colors", () => {
      // This is the actual problematic output from the bug report
      const input = `\x1b[?2004h\x1b[36m/workspace\x1b[0m $ ls -la; echo "<<CMD_DONE:$?>>"\r
\x1b[?2004l\rtotal 40\r
drwxr-xr-x 1 bimuser bimuser   140 Jan  9 18:28 \x1b[0m\x1b[01;34m.\x1b[0m\r
drwxr-xr-x 1 root    root       30 Jan  9 18:28 \x1b[01;34m..\x1b[0m\r
-rw-r--r-- 1 root    root     1919 Jan  9 18:28 README.md\r
<<CMD_DONE:0>>`

      const cleaned = stripAnsi(input)

      // Should not contain escape sequences
      expect(cleaned).not.toContain("\x1b")
      expect(cleaned).not.toContain("\r")

      // Should contain the actual content
      expect(cleaned).toContain("/workspace $ ls -la")
      expect(cleaned).toContain("total 40")
      expect(cleaned).toContain("README.md")
    })

    test("cleans prompt with colors", () => {
      const input = "\x1b[36m/workspace\x1b[0m $ "
      expect(stripAnsi(input)).toBe("/workspace $ ")
    })

    test("handles empty string", () => {
      expect(stripAnsi("")).toBe("")
    })

    test("handles string with no escape codes", () => {
      const input = "plain text output"
      expect(stripAnsi(input)).toBe("plain text output")
    })
  })
})
