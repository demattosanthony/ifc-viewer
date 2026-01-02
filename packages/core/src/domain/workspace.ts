import { z } from "zod"
import type { Context } from "../context"
import { NotFoundError } from "../errors"

export namespace Workspace {
  // === Schema ===
  export const Status = z.enum(["active", "idle", "stopped"])

  export const Entity = z.object({
    id: z.string().uuid(),
    projectId: z.string(),
    status: Status,
    createdAt: z.date(),
    lastAccessedAt: z.date(),
  })

  export const CreateInput = z.object({
    projectId: z.string(),
  })

  export const UpdateInput = z.object({
    status: Status.optional(),
    lastAccessedAt: z.date().optional(),
  })

  // === Types ===
  export type Status = z.infer<typeof Status>
  export type Entity = z.infer<typeof Entity>
  export type CreateInput = z.infer<typeof CreateInput>
  export type UpdateInput = z.infer<typeof UpdateInput>

  // === Use Cases ===
  export async function create(ctx: Context, input: CreateInput): Promise<Entity> {
    // Verify project exists
    const project = await ctx.db.projects.findById(input.projectId)
    if (!project) throw new NotFoundError("Project", input.projectId)

    // Create workspace in database
    const workspace = await ctx.db.workspaces.create(input)

    // Load project files into compute environment
    await loadProjectFiles(ctx, input.projectId)

    return workspace
  }

  export async function get(ctx: Context, id: string): Promise<Entity> {
    const workspace = await ctx.db.workspaces.findById(id)
    if (!workspace) throw new NotFoundError("Workspace", id)
    return workspace
  }

  export async function list(ctx: Context): Promise<Entity[]> {
    return ctx.db.workspaces.findAll()
  }

  export async function listActive(ctx: Context): Promise<Entity[]> {
    return ctx.db.workspaces.findActive()
  }

  export async function listByProject(
    ctx: Context,
    projectId: string
  ): Promise<Entity[]> {
    return ctx.db.workspaces.findByProjectId(projectId)
  }

  export async function touch(ctx: Context, id: string): Promise<Entity> {
    const existing = await ctx.db.workspaces.findById(id)
    if (!existing) throw new NotFoundError("Workspace", id)
    return ctx.db.workspaces.touch(id)
  }

  export async function stop(ctx: Context, id: string): Promise<Entity> {
    const existing = await ctx.db.workspaces.findById(id)
    if (!existing) throw new NotFoundError("Workspace", id)
    return ctx.db.workspaces.update(id, { status: "stopped" })
  }

  export async function remove(ctx: Context, id: string): Promise<void> {
    const existing = await ctx.db.workspaces.findById(id)
    if (!existing) throw new NotFoundError("Workspace", id)
    await ctx.db.workspaces.delete(id)
  }

  // === Internal Helpers ===
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
}
