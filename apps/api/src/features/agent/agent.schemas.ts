import { t } from "elysia";

/** Conversation status enum */
export const ConversationStatusSchema = t.Union([
  t.Literal("active"),
  t.Literal("streaming"),
  t.Literal("completed"),
  t.Literal("aborted"),
]);

/** Message role enum */
export const MessageRoleSchema = t.Union([
  t.Literal("user"),
  t.Literal("assistant"),
  t.Literal("system"),
]);

/** Message entity response */
export const MessageResponse = t.Object({
  id: t.String(),
  conversationId: t.String(),
  role: MessageRoleSchema,
  content: t.String(),
  createdAt: t.Date(),
});

/** Conversation entity response */
export const ConversationResponse = t.Object({
  id: t.String(),
  workspaceId: t.String(),
  status: ConversationStatusSchema,
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

/** Conversation with messages response */
export const ConversationWithMessagesResponse = t.Object({
  id: t.String(),
  workspaceId: t.String(),
  status: ConversationStatusSchema,
  createdAt: t.Date(),
  updatedAt: t.Date(),
  messages: t.Array(MessageResponse),
});
