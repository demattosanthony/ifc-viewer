/**
 * Slug Value Object
 *
 * Represents a URL-safe identifier (lowercase alphanumeric with hyphens).
 * Used for project IDs and other human-readable identifiers.
 */

import { z } from "zod"

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

export namespace Slug {
  /** Zod schema for validation */
  export const Schema = z
    .string()
    .min(1)
    .max(100)
    .regex(SLUG_PATTERN, "Must be lowercase alphanumeric with hyphens")
    .refine((s) => !s.includes("--"), "Cannot have consecutive hyphens")

  /** The validated slug value type */
  export type Value = z.infer<typeof Schema>

  /** Check if a string is a valid slug */
  export function isValid(value: string): boolean {
    return Schema.safeParse(value).success
  }

  /** Validate and return a slug, or throw on invalid input */
  export function validate(value: string): Value {
    return Schema.parse(value)
  }

  /** Try to validate a slug, returns null on failure */
  export function tryValidate(value: string): Value | null {
    const result = Schema.safeParse(value)
    return result.success ? result.data : null
  }

  /** Get validation error message, or null if valid */
  export function getError(value: string): string | null {
    const result = Schema.safeParse(value)
    if (result.success) return null
    return result.error.errors[0]?.message ?? "Invalid slug"
  }
}
