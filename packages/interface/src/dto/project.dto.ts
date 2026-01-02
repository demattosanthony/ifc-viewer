/**
 * Project DTOs
 *
 * Request/response schemas for project operations.
 */

import { z } from "zod"
import { ProjectSchema } from "@ifc-viewer/core"

// ============================================================================
// Request DTOs
// ============================================================================

/** Create project request */
export const CreateProjectRequest = z.object({
  id: z.string().min(1).max(100),
  description: z.string().optional(),
})
export type CreateProjectRequest = z.infer<typeof CreateProjectRequest>

/** Update project request */
export const UpdateProjectRequest = z.object({
  description: z.string().optional(),
})
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequest>

/** Project ID parameter */
export const ProjectIdParam = z.object({
  id: z.string(),
})
export type ProjectIdParam = z.infer<typeof ProjectIdParam>

// ============================================================================
// Response DTOs
// ============================================================================

/** Project response - matches domain entity */
export const ProjectResponse = ProjectSchema
export type ProjectResponse = z.infer<typeof ProjectResponse>

/** List projects response */
export const ProjectListResponse = z.array(ProjectResponse)
export type ProjectListResponse = z.infer<typeof ProjectListResponse>
