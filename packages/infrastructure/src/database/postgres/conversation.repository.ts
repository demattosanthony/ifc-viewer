import type { Conversation, ConversationRepository } from "@ifc-viewer/core"
import { ConversationSchema, generateId, NotFoundError } from "@ifc-viewer/core"
import { desc, eq } from "drizzle-orm"
import type { DrizzleDB, DrizzleTransaction } from "./db"
import { type ConversationRow, conversations } from "./schema"

const rowToEntity = (row: ConversationRow): Conversation =>
  ConversationSchema.parse({
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })

export function createConversationRepository(
  db: DrizzleDB | DrizzleTransaction
): ConversationRepository {
  return {
    async create(input: Conversation.CreateInput): Promise<Conversation> {
      const now = new Date()
      const id = generateId()
      await db.insert(conversations).values({
        id,
        projectId: input.projectId,
        title: input.title ?? null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      const [row] = await db.select().from(conversations).where(eq(conversations.id, id))
      if (!row) throw new NotFoundError("Conversation", id)
      return rowToEntity(row)
    },

    async findById(id: string): Promise<Conversation | null> {
      const [row] = await db.select().from(conversations).where(eq(conversations.id, id))
      return row ? rowToEntity(row) : null
    },

    async findByProjectId(projectId: string): Promise<Conversation[]> {
      const rows = await db
        .select()
        .from(conversations)
        .where(eq(conversations.projectId, projectId))
        .orderBy(desc(conversations.updatedAt))
      return rows.map(rowToEntity)
    },

    async update(id: string, input: Conversation.UpdateInput): Promise<Conversation> {
      const updates: Partial<ConversationRow> = { updatedAt: new Date() }
      if (input.status !== undefined) updates.status = input.status
      if (input.title !== undefined) updates.title = input.title
      await db.update(conversations).set(updates).where(eq(conversations.id, id))
      const [row] = await db.select().from(conversations).where(eq(conversations.id, id))
      if (!row) throw new NotFoundError("Conversation", id)
      return rowToEntity(row)
    },

    async delete(id: string): Promise<void> {
      await db.delete(conversations).where(eq(conversations.id, id))
    },

    async deleteByProjectId(projectId: string): Promise<void> {
      await db.delete(conversations).where(eq(conversations.projectId, projectId))
    },
  }
}
