import { z } from "zod"
import type { Context } from "../context"

export namespace Conversation {
  // === Schema ===
  export const Status = z.enum(["active", "streaming", "completed", "aborted"])

  export const Entity = z.object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    status: Status,
    createdAt: z.date(),
    updatedAt: z.date(),
  })

  export const CreateInput = z.object({
    workspaceId: z.string().uuid(),
  })

  export const UpdateInput = z.object({
    status: Status.optional(),
  })

  // === Types ===
  export type Status = z.infer<typeof Status>
  export type Entity = z.infer<typeof Entity>
  export type CreateInput = z.infer<typeof CreateInput>
  export type UpdateInput = z.infer<typeof UpdateInput>

  // === Use Cases ===
  export async function getOrCreate(
    ctx: Context,
    workspaceId: string
  ): Promise<Entity> {
    const existing = await ctx.db.conversations.findActiveByWorkspaceId(workspaceId)
    if (existing) return existing
    return ctx.db.conversations.create({ workspaceId })
  }

  export async function getActive(
    ctx: Context,
    workspaceId: string
  ): Promise<Entity | null> {
    return ctx.db.conversations.findActiveByWorkspaceId(workspaceId)
  }

  export async function updateStatus(
    ctx: Context,
    id: string,
    status: Status
  ): Promise<Entity> {
    return ctx.db.conversations.update(id, { status })
  }

  export async function complete(ctx: Context, id: string): Promise<Entity> {
    return ctx.db.conversations.update(id, { status: "completed" })
  }

  export async function abort(ctx: Context, id: string): Promise<Entity> {
    return ctx.db.conversations.update(id, { status: "aborted" })
  }

  export async function clearHistory(
    ctx: Context,
    workspaceId: string
  ): Promise<void> {
    await ctx.db.conversations.deleteByWorkspaceId(workspaceId)
  }
}
