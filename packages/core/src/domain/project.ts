import type { Project, CreateProjectInput } from "../schema/project"
import { ProjectId } from "../schema/project"

/** Create a new project from input */
export const createProject = (input: CreateProjectInput): Project => ({
  id: input.id,
  description: input.description ?? null,
  createdAt: new Date(),
  updatedAt: new Date(),
})

/** Validate a project slug */
export const isValidProjectSlug = (slug: string): boolean => {
  return ProjectId.safeParse(slug).success
}

/** Update project with new values */
export const updateProject = (
  project: Project,
  updates: { description?: string }
): Project => ({
  ...project,
  description: updates.description ?? project.description,
  updatedAt: new Date(),
})
