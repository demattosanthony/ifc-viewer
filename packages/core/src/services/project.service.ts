/**
 * Project Service
 *
 * Application services for project operations that require
 * coordination between multiple infrastructure components.
 */

import type { Context } from "../context"
import type { Project } from "../domain"
import { isValidProjectId } from "../domain"
import { InvalidProjectIdError } from "../domain/errors"

export type CreateProjectInput = {
  id: string
  description?: string
}

/**
 * Create a new project.
 *
 * - Validates the project ID is a valid slug
 * - Idempotent: returns existing project if found
 * - Initializes storage directory for the project
 */
export async function createProjectWithStorage(
  ctx: Context,
  input: CreateProjectInput
): Promise<Project> {
  // Validate slug
  if (!isValidProjectId(input.id)) {
    throw new InvalidProjectIdError(input.id)
  }

  // Idempotent: return existing project if found
  const existing = await ctx.db.projects.findById(input.id)
  if (existing) return existing

  // Create entity and persist
  const project = await ctx.db.projects.create({
    id: input.id,
    description: input.description,
  })

  // Initialize storage directory
  await ctx.storage.put(`projects/${input.id}/.gitkeep`, "", {
    contentType: "text/plain",
  })

  return project
}
