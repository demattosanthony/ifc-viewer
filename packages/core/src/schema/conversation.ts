import { z } from "zod"

export const ConversationStatus = z.enum(["active", "streaming", "completed", "aborted"])
export type ConversationStatus = z.infer<typeof ConversationStatus>

export const Conversation = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  status: ConversationStatus,
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Conversation = z.infer<typeof Conversation>

export const CreateConversationInput = z.object({
  workspaceId: z.string().uuid(),
})
export type CreateConversationInput = z.infer<typeof CreateConversationInput>

export const UpdateConversationInput = z.object({
  status: ConversationStatus.optional(),
})
export type UpdateConversationInput = z.infer<typeof UpdateConversationInput>
