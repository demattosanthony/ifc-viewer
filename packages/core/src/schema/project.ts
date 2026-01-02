import { z } from "zod"

/** Project slug validation - GitHub-style naming */
const projectSlugPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

export const ProjectId = z
  .string()
  .min(1)
  .max(100)
  .regex(projectSlugPattern, "Must be lowercase alphanumeric with hyphens")
  .refine((s) => !s.includes("--"), "Cannot have consecutive hyphens")

export type ProjectId = z.infer<typeof ProjectId>

export const Project = z.object({
  id: ProjectId,
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Project = z.infer<typeof Project>

export const CreateProjectInput = z.object({
  id: ProjectId,
  description: z.string().optional(),
})
export type CreateProjectInput = z.infer<typeof CreateProjectInput>

export const UpdateProjectInput = z.object({
  description: z.string().optional(),
})
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>
