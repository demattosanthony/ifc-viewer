import { z } from "zod"
import type { Context } from "../context"

export namespace Message {
  // === Schema ===
  export const Role = z.enum(["user", "assistant", "system"])

  export const Entity = z.object({
    id: z.string().uuid(),
    conversationId: z.string().uuid(),
    role: Role,
    content: z.string(),
    createdAt: z.date(),
  })

  export const CreateInput = z.object({
    conversationId: z.string().uuid(),
    role: Role,
    content: z.string(),
  })

  // === Types ===
  export type Role = z.infer<typeof Role>
  export type Entity = z.infer<typeof Entity>
  export type CreateInput = z.infer<typeof CreateInput>

  // === Use Cases ===
  export async function add(ctx: Context, input: CreateInput): Promise<Entity> {
    return ctx.db.messages.create(input)
  }

  export async function listByConversation(
    ctx: Context,
    conversationId: string
  ): Promise<Entity[]> {
    return ctx.db.messages.findByConversationId(conversationId)
  }
}
