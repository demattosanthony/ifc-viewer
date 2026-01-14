import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title"),
  status: text("status", { enum: ["active", "streaming", "completed", "aborted"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const messageParts = sqliteTable("message_parts", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  type: text("type", { enum: ["text", "tool-use"] }).notNull(),
  // For type="text"
  text: text("text"),
  // For type="tool-use"
  toolCallId: text("tool_call_id"),
  toolName: text("tool_name"),
  toolInput: text("tool_input", { mode: "json" }).$type<Record<string, unknown>>(),
  toolOutput: text("tool_output", { mode: "json" }),
  toolStatus: text("tool_status", { enum: ["success", "error", "aborted"] }),
  toolError: text("tool_error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const models = sqliteTable("models", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  discipline: text("discipline", { enum: ["architecture", "structure", "mep", "site", "other"] })
    .notNull()
    .default("other"),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  /** Path to pre-converted fragment file in storage */
  fragmentPath: text("fragment_path"),
  /** Fragment file size in bytes */
  fragmentSize: integer("fragment_size"),
  /** Fragment format version for invalidation */
  fragmentVersion: text("fragment_version"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export type ProjectRow = typeof projects.$inferSelect
export type NewProjectRow = typeof projects.$inferInsert
export type ConversationRow = typeof conversations.$inferSelect
export type NewConversationRow = typeof conversations.$inferInsert
export type MessageRow = typeof messages.$inferSelect
export type NewMessageRow = typeof messages.$inferInsert
export type MessagePartRow = typeof messageParts.$inferSelect
export type NewMessagePartRow = typeof messageParts.$inferInsert
export type ModelRow = typeof models.$inferSelect
export type NewModelRow = typeof models.$inferInsert
