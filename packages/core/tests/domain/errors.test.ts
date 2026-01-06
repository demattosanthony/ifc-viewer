/**
 * Domain Error Tests
 *
 * Tests for domain error classes and utilities.
 */

import { describe, test, expect } from "bun:test"
import {
  DomainError,
  isDomainError,
  NotFoundError,
  DuplicateError,
  ValidationError,
  InvalidProjectIdError,
} from "../../src/domain/errors"

describe("DomainError", () => {
  describe("constructor", () => {
    test("sets message, code, and statusCode", () => {
      const error = new DomainError("Test error", "TEST_ERROR", 400)

      expect(error.message).toBe("Test error")
      expect(error.code).toBe("TEST_ERROR")
      expect(error.statusCode).toBe(400)
    })

    test("defaults statusCode to 500", () => {
      const error = new DomainError("Test error", "TEST_ERROR")

      expect(error.statusCode).toBe(500)
    })

    test("sets name to DomainError", () => {
      const error = new DomainError("Test error", "TEST_ERROR")

      expect(error.name).toBe("DomainError")
    })

    test("is instance of Error", () => {
      const error = new DomainError("Test error", "TEST_ERROR")

      expect(error).toBeInstanceOf(Error)
    })
  })

  describe("toJSON", () => {
    test("returns formatted error object", () => {
      const error = new DomainError("Test error", "TEST_CODE", 400)

      expect(error.toJSON()).toEqual({
        error: {
          code: "TEST_CODE",
          message: "Test error",
        },
      })
    })
  })
})

describe("isDomainError", () => {
  test("returns true for DomainError instances", () => {
    const error = new DomainError("Test", "TEST")
    expect(isDomainError(error)).toBe(true)
  })

  test("returns true for DomainError subclasses", () => {
    const error = new NotFoundError("Resource", "123")
    expect(isDomainError(error)).toBe(true)
  })

  test("returns false for regular Error", () => {
    const error = new Error("Regular error")
    expect(isDomainError(error)).toBe(false)
  })

  test("returns false for non-Error objects", () => {
    expect(isDomainError(null)).toBe(false)
    expect(isDomainError(undefined)).toBe(false)
    expect(isDomainError("error")).toBe(false)
    expect(isDomainError({ message: "error" })).toBe(false)
  })
})

describe("NotFoundError", () => {
  test("constructs with resource and id", () => {
    const error = new NotFoundError("Project", "my-project")

    expect(error.message).toBe("Project 'my-project' not found")
    expect(error.code).toBe("NOT_FOUND")
    expect(error.statusCode).toBe(404)
    expect(error.name).toBe("NotFoundError")
  })

  test("is DomainError", () => {
    const error = new NotFoundError("Resource", "id")
    expect(isDomainError(error)).toBe(true)
  })
})

describe("DuplicateError", () => {
  test("constructs with resource and field", () => {
    const error = new DuplicateError("Project", "id")

    expect(error.message).toBe("Project with this id already exists")
    expect(error.code).toBe("DUPLICATE")
    expect(error.statusCode).toBe(409)
    expect(error.name).toBe("DuplicateError")
  })

  test("is DomainError", () => {
    const error = new DuplicateError("Resource", "field")
    expect(isDomainError(error)).toBe(true)
  })
})

describe("ValidationError", () => {
  test("constructs with message", () => {
    const error = new ValidationError("Invalid input")

    expect(error.message).toBe("Invalid input")
    expect(error.code).toBe("VALIDATION_ERROR")
    expect(error.statusCode).toBe(400)
    expect(error.name).toBe("ValidationError")
  })

  test("is DomainError", () => {
    const error = new ValidationError("Invalid")
    expect(isDomainError(error)).toBe(true)
  })
})

describe("InvalidProjectIdError", () => {
  test("constructs with invalid id", () => {
    const error = new InvalidProjectIdError("My Project!")

    expect(error.message).toContain("My Project!")
    expect(error.message).toContain("lowercase alphanumeric")
    expect(error.code).toBe("INVALID_PROJECT_ID")
    expect(error.statusCode).toBe(400)
    expect(error.name).toBe("InvalidProjectIdError")
  })

  test("is DomainError", () => {
    const error = new InvalidProjectIdError("bad")
    expect(isDomainError(error)).toBe(true)
  })
})
