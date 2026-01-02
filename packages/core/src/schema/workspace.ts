import { z } from "zod"

export const WorkspaceStatus = z.enum(["active", "idle", "stopped"])
export type WorkspaceStatus = z.infer<typeof WorkspaceStatus>

export const Workspace = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  status: WorkspaceStatus,
  createdAt: z.date(),
  lastAccessedAt: z.date(),
})
export type Workspace = z.infer<typeof Workspace>

export const CreateWorkspaceInput = z.object({
  projectId: z.string(),
})
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInput>

export const UpdateWorkspaceInput = z.object({
  status: WorkspaceStatus.optional(),
  lastAccessedAt: z.date().optional(),
})
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceInput>
