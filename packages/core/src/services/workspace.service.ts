/**
 * Workspace Service
 *
 * Application services for workspace operations that require
 * coordination between multiple infrastructure components.
 */

import { join } from "node:path"
import { rm } from "node:fs/promises"
import type { Context } from "../context"
import type { Workspace } from "../domain"
import type { Computer, FileEntry } from "../ports"
import { NotFoundError } from "../domain/errors"
import { generateId } from "../utils"


export type CreateWorkspaceInput = {
  projectId: string
}

/**
 * Create a new workspace for a project.
 *
 * - Verifies the project exists
 * - Creates workspace in database with isolated working directory
 * - Creates compute instance for the workspace
 * - Copies project files from storage into compute environment
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

  // Generate workspace ID and working directory path
  const workspaceId = generateId()
  const workingDirectory = join(ctx.workspacesDir, workspaceId)

  // Create workspace in database with the same ID used for the directory
  const workspace = await ctx.db.workspaces.create({
    id: workspaceId,
    projectId: input.projectId,
    workingDirectory,
  })

  // Create compute instance for this workspace
  const computer = await ctx.getOrCreateCompute(workspaceId, workingDirectory)

  // Copy project files from storage into compute environment
  await copyProjectFilesToCompute(ctx, input.projectId, computer)

  return workspace
}

/**
 * Copy project files from storage into a compute environment.
 */
async function copyProjectFilesToCompute(
  ctx: Context,
  projectId: string,
  computer: { files: { mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>; write: (path: string, content: Uint8Array) => Promise<void> } }
): Promise<void> {
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
        await computer.files.mkdir(parentDir, { recursive: true })
      } catch {
        // Directory might already exist
      }
    }

    await computer.files.write(relativePath, obj.data)
  }
}

/**
 * Get an existing workspace and ensure its compute is running.
 *
 * @throws NotFoundError if workspace doesn't exist
 */
export async function getWorkspaceWithCompute(
  ctx: Context,
  workspaceId: string
): Promise<Workspace> {
  const workspace = await ctx.db.workspaces.findById(workspaceId)
  if (!workspace) throw new NotFoundError("Workspace", workspaceId)

  // Ensure compute instance exists
  await ctx.getOrCreateCompute(workspace.id, workspace.workingDirectory)

  return workspace
}

/**
 * Sync compute filesystem state to storage.
 * 
 * This handles files that were modified via terminal commands (rm, mv, etc.)
 * which bypass the normal storage sync callbacks.
 */
async function syncComputeToStorage(
  ctx: Context,
  projectId: string,
  computer: Computer
): Promise<void> {
  const storagePrefix = `projects/${projectId}/`
  
  console.log(`[WorkspaceService] Syncing compute to storage for project ${projectId}`)
  
  // Get current files in compute
  const computeFiles = new Set<string>()
  await collectComputeFiles(computer, ".", computeFiles)
  
  console.log(`[WorkspaceService] Found ${computeFiles.size} files in compute`)
  
  // Get current files in storage
  const storageFiles = new Set<string>()
  for await (const entry of ctx.storage.list(storagePrefix)) {
    const relativePath = entry.key.slice(storagePrefix.length)
    storageFiles.add(relativePath)
  }
  
  console.log(`[WorkspaceService] Found ${storageFiles.size} files in storage`)
  
  // Find files that were deleted from compute but still exist in storage
  for (const storagePath of storageFiles) {
    if (!computeFiles.has(storagePath)) {
      const storageKey = `${storagePrefix}${storagePath}`
      console.log(`[WorkspaceService] Deleting orphaned storage file: ${storageKey}`)
      await ctx.storage.delete(storageKey)
    }
  }
  
  // Sync files from compute to storage (new or modified files)
  for (const computePath of computeFiles) {
    try {
      const content = await computer.files.read(computePath, { encoding: "binary" })
      const computeContent = content.type === "binary" ? content.content : new TextEncoder().encode(content.content)
      const storageKey = `${storagePrefix}${computePath}`
      
      if (!storageFiles.has(computePath)) {
        // New file created via terminal
        console.log(`[WorkspaceService] Syncing new file to storage: ${computePath}`)
        await ctx.storage.put(storageKey, computeContent)
      } else {
        // File exists in both - check if modified
        const storageObj = await ctx.storage.get(storageKey)
        if (storageObj) {
          // Compare content to detect modifications
          const storageContent = storageObj.data
          if (!buffersEqual(computeContent, storageContent)) {
            console.log(`[WorkspaceService] Syncing modified file to storage: ${computePath}`)
            await ctx.storage.put(storageKey, computeContent)
          }
        }
      }
    } catch (err) {
      console.error(`[WorkspaceService] Failed to sync file ${computePath}:`, err)
    }
  }
  
  console.log(`[WorkspaceService] Sync complete`)
}

/**
 * Compare two Uint8Array buffers for equality.
 */
function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Recursively collect all file paths in compute.
 */
async function collectComputeFiles(
  computer: Computer,
  path: string,
  files: Set<string>
): Promise<void> {
  try {
    const entries = await computer.files.list(path)
    for (const entry of entries) {
      if (entry.type === "directory") {
        await collectComputeFiles(computer, entry.path, files)
      } else if (entry.type === "file") {
        // Normalize path (remove leading slash)
        const normalizedPath = entry.path.startsWith("/") ? entry.path.slice(1) : entry.path
        files.add(normalizedPath)
      }
    }
  } catch (err) {
    console.error(`[WorkspaceService] Failed to list ${path}:`, err)
  }
}

/**
 * Stop a workspace and dispose its compute instance.
 *
 * Syncs any file changes made via terminal to storage before stopping.
 * Also cleans up the workspace working directory since workspaces are ephemeral.
 */
export async function stopWorkspaceWithSync(
  ctx: Context,
  workspaceId: string
): Promise<Workspace> {
  const workspace = await ctx.db.workspaces.findById(workspaceId)
  if (!workspace) throw new NotFoundError("Workspace", workspaceId)

  // Sync compute filesystem to storage before disposing
  const computer = ctx.getCompute(workspaceId)
  if (computer) {
    try {
      await syncComputeToStorage(ctx, workspace.projectId, computer)
    } catch (err) {
      console.error(`[WorkspaceService] Failed to sync compute to storage:`, err)
      // Continue with shutdown even if sync fails
    }
  }

  // Dispose compute instance
  await ctx.disposeCompute(workspaceId)

  // Clean up workspace working directory (ephemeral)
  try {
    await rm(workspace.workingDirectory, { recursive: true, force: true })
  } catch {
    // Directory might already be gone or inaccessible
  }

  // Update workspace status
  return ctx.db.workspaces.update(workspaceId, { status: "stopped" })
}

/**
 * Delete a workspace completely.
 *
 * Disposes compute, cleans up working directory, and removes from database.
 */
export async function deleteWorkspace(
  ctx: Context,
  workspaceId: string
): Promise<void> {
  const workspace = await ctx.db.workspaces.findById(workspaceId)
  if (!workspace) throw new NotFoundError("Workspace", workspaceId)

  // Dispose compute instance
  await ctx.disposeCompute(workspaceId)

  // Clean up workspace working directory
  try {
    await rm(workspace.workingDirectory, { recursive: true, force: true })
  } catch {
    // Directory might already be gone or inaccessible
  }

  // Delete from database
  await ctx.db.workspaces.delete(workspaceId)
}
