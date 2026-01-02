/**
 * Project Entity
 *
 * Represents a project in the system. Projects are persistent containers
 * that hold files and can have multiple workspaces.
 */

import { z } from "zod"
import { Slug } from "../value-objects/slug.vo"

// ============================================================================
// Schema & Types
// ============================================================================

export const ProjectSchema = z.object({
  id: Slug.Schema,
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Project = z.infer<typeof ProjectSchema>

/** Namespace for Project-related input types */
export namespace Project {
  export type CreateInput = {
    id: string
    description?: string | null
  }

  export type UpdateInput = {
    description?: string | null
  }
}

// ============================================================================
// Factory & Helpers
// ============================================================================

/**
 * Create a new Project entity.
 * Validates the ID is a valid slug.
 *
 * @throws Error if ID is not a valid slug
 */
export function createProject(input: Project.CreateInput): Project {
  const id = Slug.validate(input.id)
  const now = new Date()
  return {
    id,
    description: input.description ?? null,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Check if a string is a valid project ID (slug).
 */
export function isValidProjectId(id: string): boolean {
  return Slug.isValid(id)
}
