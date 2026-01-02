/**
 * Project Use Cases
 *
 * Application logic for project operations.
 * Combines domain logic with side effects through context.
 */

import type { Context } from "../context"
import type { Project, CreateProjectInput, UpdateProjectInput } from "../schema/project"
import { isValidProjectSlug } from "../domain/project"
import { NotFoundError, ValidationError } from "../errors"

/** Create a new project (idempotent - returns existing if found) */
export const createProject = async (
  ctx: Context,
  input: CreateProjectInput
): Promise<Project> => {
  if (!isValidProjectSlug(input.id)) {
    throw new ValidationError(
      "Invalid project ID. Must be lowercase alphanumeric with hyphens, 1-100 characters."
    )
  }

  // Idempotent: return existing project if found
  const existing = await ctx.db.projects.findById(input.id)
  if (existing) return existing

  // Create in database
  const project = await ctx.db.projects.create(input)

  // Initialize storage directory
  await ctx.storage.put(`projects/${input.id}/.gitkeep`, "", {
    contentType: "text/plain",
  })

  return project
}

/** Get a project by ID */
export const getProject = async (
  ctx: Context,
  id: string
): Promise<Project> => {
  const project = await ctx.db.projects.findById(id)
  if (!project) throw new NotFoundError("Project", id)
  return project
}

/** List all projects */
export const listProjects = async (ctx: Context): Promise<Project[]> => {
  return ctx.db.projects.findAll()
}

/** Update a project */
export const updateProject = async (
  ctx: Context,
  id: string,
  input: UpdateProjectInput
): Promise<Project> => {
  const existing = await ctx.db.projects.findById(id)
  if (!existing) throw new NotFoundError("Project", id)

  return ctx.db.projects.update(id, input)
}

/** Delete a project and all its files */
export const deleteProject = async (
  ctx: Context,
  id: string
): Promise<void> => {
  const existing = await ctx.db.projects.findById(id)
  if (!existing) throw new NotFoundError("Project", id)

  // Delete all project files from storage
  const prefix = `projects/${id}/`
  for await (const entry of ctx.storage.list(prefix)) {
    await ctx.storage.delete(entry.key)
  }

  // Delete from database (cascades to workspaces, conversations, messages)
  await ctx.db.projects.delete(id)
}
