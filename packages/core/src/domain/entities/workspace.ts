/**
 * Workspace Entity
 *
 * Represents an ephemeral compute environment associated with a project.
 * Workspaces have a lifecycle (active -> idle -> stopped).
 */

import { z } from "zod"

// ============================================================================
// Schema & Types
// ============================================================================

export const WorkspaceStatusSchema = z.enum(["active", "idle", "stopped"])

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  status: WorkspaceStatusSchema,
  /** Path to workspace's isolated working directory */
  workingDirectory: z.string(),
  createdAt: z.date(),
  lastAccessedAt: z.date(),
})

export type WorkspaceStatus = z.infer<typeof WorkspaceStatusSchema>
export type Workspace = z.infer<typeof WorkspaceSchema>

/** Namespace for Workspace-related input types */
export namespace Workspace {
  export type CreateInput = {
    /** Optional ID - if not provided, one will be generated */
    id?: string
    projectId: string
    workingDirectory: string
  }

  export type UpdateInput = {
    status?: WorkspaceStatus
    lastAccessedAt?: Date
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if workspace is active (not stopped).
 */
export function isWorkspaceActive(workspace: Workspace): boolean {
  return workspace.status !== "stopped"
}
