/**
 * Workspace Service
 *
 * Application services for workspace operations that require
 * coordination between multiple infrastructure components.
 */

import type { Context } from "../context"
import type { Workspace } from "../domain"
import { NotFoundError } from "../domain/errors"

export type CreateWorkspaceInput = {
  projectId: string
}

/**
 * Create a new workspace for a project.
 *
 * - Verifies the project exists
 * - Creates workspace in database
 * - Loads project files into compute environment
 *
 * @throws NotFoundError if project doesn't exist
 */
export async function createWorkspaceWithFiles(
  ctx: Context,
  input: CreateWorkspaceInput
): Promise<Workspace> {
  // Verify project exists
  const project = await ctx.db.projects.findById(input.projectId)
  if (!project) throw new NotFoundError("Project", input.projectId)

  // Create workspace in database
  const workspace = await ctx.db.workspaces.create(input)

  // Load project files into compute environment
  await loadProjectFiles(ctx, input.projectId)

  return workspace
}

/**
 * Load project files from storage into the compute environment.
 */
async function loadProjectFiles(ctx: Context, projectId: string): Promise<void> {
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
