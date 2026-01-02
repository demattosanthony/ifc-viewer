import { z } from "zod"
import type { Context } from "../context"
import { NotFoundError, ValidationError } from "../errors"

const slugPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

export namespace Project {
  // === Schema ===
  export const Id = z
    .string()
    .min(1)
    .max(100)
    .regex(slugPattern, "Must be lowercase alphanumeric with hyphens")
    .refine((s) => !s.includes("--"), "Cannot have consecutive hyphens")

  export const Entity = z.object({
    id: Id,
    description: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })

  export const CreateInput = z.object({
    id: Id,
    description: z.string().optional(),
  })

  export const UpdateInput = z.object({
    description: z.string().optional(),
  })

  // === Types ===
  export type Id = z.infer<typeof Id>
  export type Entity = z.infer<typeof Entity>
  export type CreateInput = z.infer<typeof CreateInput>
  export type UpdateInput = z.infer<typeof UpdateInput>

  // === Helpers ===
  export function isValidSlug(slug: string): boolean {
    return Id.safeParse(slug).success
  }

  // === Use Cases ===
  export async function create(ctx: Context, input: CreateInput): Promise<Entity> {
    if (!isValidSlug(input.id)) {
      throw new ValidationError(
        "Invalid project ID. Must be lowercase alphanumeric with hyphens, 1-100 characters."
      )
    }

    // Idempotent: return existing project if found
    const existing = await ctx.db.projects.findById(input.id)
    if (existing) return existing

    const project = await ctx.db.projects.create(input)

    // Initialize storage directory
    await ctx.storage.put(`projects/${input.id}/.gitkeep`, "", {
      contentType: "text/plain",
    })

    return project
  }

  export async function get(ctx: Context, id: string): Promise<Entity> {
    const project = await ctx.db.projects.findById(id)
    if (!project) throw new NotFoundError("Project", id)
    return project
  }

  export async function list(ctx: Context): Promise<Entity[]> {
    return ctx.db.projects.findAll()
  }

  export async function update(
    ctx: Context,
    id: string,
    input: UpdateInput
  ): Promise<Entity> {
    const existing = await ctx.db.projects.findById(id)
    if (!existing) throw new NotFoundError("Project", id)
    return ctx.db.projects.update(id, input)
  }

  export async function remove(ctx: Context, id: string): Promise<void> {
    const existing = await ctx.db.projects.findById(id)
    if (!existing) throw new NotFoundError("Project", id)

    // Delete all project files from storage
    const prefix = `projects/${id}/`
    for await (const entry of ctx.storage.list(prefix)) {
      await ctx.storage.delete(entry.key)
    }

    // Delete from database (cascades to workspaces, conversations, messages)
    await ctx.db.projects.delete(id)
  }
}
