/**
 * Slug Value Object Tests
 *
 * Tests for the Slug value object which validates URL-safe identifiers
 * used for project IDs and other human-readable identifiers.
 */

import { describe, expect, test } from "bun:test"
import { Slug } from "../../src/domain/value-objects/slug.vo"

describe("Slug", () => {
  describe("isValid", () => {
    test("accepts valid single character slug", () => {
      expect(Slug.isValid("a")).toBe(true)
      expect(Slug.isValid("z")).toBe(true)
      expect(Slug.isValid("0")).toBe(true)
      expect(Slug.isValid("9")).toBe(true)
    })

    test("accepts valid multi-character slugs", () => {
      expect(Slug.isValid("my-project")).toBe(true)
      expect(Slug.isValid("test123")).toBe(true)
      expect(Slug.isValid("a-b-c")).toBe(true)
      expect(Slug.isValid("project-name-123")).toBe(true)
      expect(Slug.isValid("123-abc")).toBe(true)
    })

    test("rejects uppercase characters", () => {
      expect(Slug.isValid("My-Project")).toBe(false)
      expect(Slug.isValid("PROJECT")).toBe(false)
      expect(Slug.isValid("myProject")).toBe(false)
    })

    test("rejects leading hyphens", () => {
      expect(Slug.isValid("-invalid")).toBe(false)
      expect(Slug.isValid("--invalid")).toBe(false)
    })

    test("rejects trailing hyphens", () => {
      expect(Slug.isValid("invalid-")).toBe(false)
      expect(Slug.isValid("invalid--")).toBe(false)
    })

    test("rejects consecutive hyphens", () => {
      expect(Slug.isValid("invalid--slug")).toBe(false)
      expect(Slug.isValid("a--b--c")).toBe(false)
    })

    test("rejects empty string", () => {
      expect(Slug.isValid("")).toBe(false)
    })

    test("rejects strings over 100 characters", () => {
      const longSlug = "a".repeat(101)
      expect(Slug.isValid(longSlug)).toBe(false)

      const maxLengthSlug = "a".repeat(100)
      expect(Slug.isValid(maxLengthSlug)).toBe(true)
    })

    test("rejects special characters", () => {
      expect(Slug.isValid("hello_world")).toBe(false)
      expect(Slug.isValid("hello.world")).toBe(false)
      expect(Slug.isValid("hello world")).toBe(false)
      expect(Slug.isValid("hello@world")).toBe(false)
      expect(Slug.isValid("hello/world")).toBe(false)
    })
  })

  describe("validate", () => {
    test("returns the slug for valid input", () => {
      expect(Slug.validate("my-project")).toBe("my-project")
      expect(Slug.validate("test123")).toBe("test123")
    })

    test("throws for invalid input", () => {
      expect(() => Slug.validate("Invalid")).toThrow()
      expect(() => Slug.validate("")).toThrow()
      expect(() => Slug.validate("--bad")).toThrow()
    })
  })

  describe("tryValidate", () => {
    test("returns the slug for valid input", () => {
      expect(Slug.tryValidate("my-project")).toBe("my-project")
      expect(Slug.tryValidate("a")).toBe("a")
    })

    test("returns null for invalid input", () => {
      expect(Slug.tryValidate("Invalid")).toBeNull()
      expect(Slug.tryValidate("")).toBeNull()
      expect(Slug.tryValidate("--bad")).toBeNull()
      expect(Slug.tryValidate("bad--slug")).toBeNull()
    })
  })

  describe("getError", () => {
    test("returns null for valid slug", () => {
      expect(Slug.getError("valid-slug")).toBeNull()
      expect(Slug.getError("test123")).toBeNull()
    })

    test("returns error message for empty string", () => {
      const error = Slug.getError("")
      expect(error).not.toBeNull()
      expect(typeof error).toBe("string")
    })

    test("returns error message for invalid pattern", () => {
      const error = Slug.getError("UPPERCASE")
      expect(error).not.toBeNull()
      expect(error).toContain("lowercase")
    })

    test("returns error message for consecutive hyphens", () => {
      const error = Slug.getError("bad--slug")
      expect(error).not.toBeNull()
      expect(error).toContain("consecutive")
    })

    test("returns error message for too long string", () => {
      const error = Slug.getError("a".repeat(101))
      expect(error).not.toBeNull()
    })
  })
})
