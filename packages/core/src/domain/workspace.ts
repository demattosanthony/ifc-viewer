import type { Workspace, CreateWorkspaceInput, WorkspaceStatus } from "../schema/workspace"

/** Create a new workspace from input */
export const createWorkspace = (
  input: CreateWorkspaceInput & { id: string }
): Workspace => ({
  id: input.id,
  projectId: input.projectId,
  status: "active",
  createdAt: new Date(),
  lastAccessedAt: new Date(),
})

/** Update workspace status */
export const updateWorkspaceStatus = (
  workspace: Workspace,
  status: WorkspaceStatus
): Workspace => ({
  ...workspace,
  status,
})

/** Touch workspace (update last accessed time) */
export const touchWorkspace = (workspace: Workspace): Workspace => ({
  ...workspace,
  lastAccessedAt: new Date(),
})

/** Check if workspace is active */
export const isWorkspaceActive = (workspace: Workspace): boolean =>
  workspace.status === "active"
