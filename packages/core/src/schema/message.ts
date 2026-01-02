import { z } from "zod"

export const MessageRole = z.enum(["user", "assistant", "system"])
export type MessageRole = z.infer<typeof MessageRole>

export const Message = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: MessageRole,
  content: z.string(),
  createdAt: z.date(),
})
export type Message = z.infer<typeof Message>

export const CreateMessageInput = z.object({
  conversationId: z.string().uuid(),
  role: MessageRole,
  content: z.string(),
})
export type CreateMessageInput = z.infer<typeof CreateMessageInput>
