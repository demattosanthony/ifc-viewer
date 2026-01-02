/**
 * Workspace Use Cases
 *
 * Application logic for workspace operations.
 * Workspaces are ephemeral compute environments tied to projects.
 */

import type { Context } from "../context"
import type { Workspace, CreateWorkspaceInput } from "../schema/workspace"
import { NotFoundError } from "../errors"

/** Create a new workspace for a project */
export const createWorkspace = async (
  ctx: Context,
  input: CreateWorkspaceInput
): Promise<Workspace> => {
  // Verify project exists
  const project = await ctx.db.projects.findById(input.projectId)
  if (!project) throw new NotFoundError("Project", input.projectId)

  // Create workspace in database
  const workspace = await ctx.db.workspaces.create(input)

  // Load project files into compute environment
  await loadProjectFiles(ctx, input.projectId)

  return workspace
}

/** Get a workspace by ID */
export const getWorkspace = async (
  ctx: Context,
  id: string
): Promise<Workspace> => {
  const workspace = await ctx.db.workspaces.findById(id)
  if (!workspace) throw new NotFoundError("Workspace", id)
  return workspace
}

/** List all workspaces */
export const listWorkspaces = async (ctx: Context): Promise<Workspace[]> => {
  return ctx.db.workspaces.findAll()
}

/** List active (non-stopped) workspaces */
export const listActiveWorkspaces = async (ctx: Context): Promise<Workspace[]> => {
  return ctx.db.workspaces.findActive()
}

/** List workspaces for a project */
export const listProjectWorkspaces = async (
  ctx: Context,
  projectId: string
): Promise<Workspace[]> => {
  return ctx.db.workspaces.findByProjectId(projectId)
}

/** Touch a workspace (update last accessed time) */
export const touchWorkspace = async (
  ctx: Context,
  id: string
): Promise<Workspace> => {
  const existing = await ctx.db.workspaces.findById(id)
  if (!existing) throw new NotFoundError("Workspace", id)

  return ctx.db.workspaces.touch(id)
}

/** Stop a workspace */
export const stopWorkspace = async (
  ctx: Context,
  id: string
): Promise<Workspace> => {
  const existing = await ctx.db.workspaces.findById(id)
  if (!existing) throw new NotFoundError("Workspace", id)

  return ctx.db.workspaces.update(id, { status: "stopped" })
}

/** Delete a workspace */
export const deleteWorkspace = async (
  ctx: Context,
  id: string
): Promise<void> => {
  const existing = await ctx.db.workspaces.findById(id)
  if (!existing) throw new NotFoundError("Workspace", id)

  await ctx.db.workspaces.delete(id)
}

/** Load project files from storage into compute environment */
const loadProjectFiles = async (
  ctx: Context,
  projectId: string
): Promise<void> => {
  const prefix = `projects/${projectId}/`

  for await (const entry of ctx.storage.list(prefix)) {
    const relativePath = entry.key.slice(prefix.length)
    if (!relativePath) continue

    const obj = await ctx.storage.get(entry.key)
    if (!obj) continue

    // Ensure parent directory exists
    const parentDir = relativePath.includes("/")
      ? relativePath.slice(0, relativePath.lastIndexOf("/"))
      : null

    if (parentDir) {
      try {
        await ctx.compute.files.mkdir(parentDir, { recursive: true })
      } catch {
        // Directory might already exist
      }
    }

    await ctx.compute.files.write(relativePath, obj.data)
  }
}
