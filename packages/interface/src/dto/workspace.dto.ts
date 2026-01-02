/**
 * Workspace DTOs
 *
 * Request/response schemas for workspace operations.
 */

import { z } from "zod"
import { WorkspaceSchema } from "@ifc-viewer/core"

// ============================================================================
// Request DTOs
// ============================================================================

/** Create workspace request */
export const CreateWorkspaceRequest = z.object({
  projectId: z.string(),
})
export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceRequest>

/** Workspace ID parameter */
export const WorkspaceIdParam = z.object({
  id: z.string(),
})
export type WorkspaceIdParam = z.infer<typeof WorkspaceIdParam>

// ============================================================================
// Response DTOs
// ============================================================================

/** Workspace response - matches domain entity */
export const WorkspaceResponse = WorkspaceSchema
export type WorkspaceResponse = z.infer<typeof WorkspaceResponse>

/** List workspaces response */
export const WorkspaceListResponse = z.array(WorkspaceResponse)
export type WorkspaceListResponse = z.infer<typeof WorkspaceListResponse>
