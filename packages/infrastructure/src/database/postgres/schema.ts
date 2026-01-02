import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(), // Slug (e.g., "sample-project")
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
});

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["active", "idle", "stopped"],
  })
    .notNull()
    .default("active"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
  lastAccessedAt: timestamp("last_accessed_at", { mode: "date", withTimezone: true }).notNull(),
});

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title"),
  status: text("status", {
    enum: ["active", "streaming", "completed", "aborted"],
  })
    .notNull()
    .default("active"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull(),
});

// Type exports for use in repositories
export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type NewWorkspaceRow = typeof workspaces.$inferInsert;
export type ConversationRow = typeof conversations.$inferSelect;
export type NewConversationRow = typeof conversations.$inferInsert;
export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
