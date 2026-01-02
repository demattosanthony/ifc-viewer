import { eq, asc } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import type { Message, MessageOps, CreateMessageInput } from "@ifc-viewer/core"
import { messages } from "./schema"
import type { DrizzleDB } from "./db"

const rowToMessage = (row: typeof messages.$inferSelect): Message => ({
  id: row.id,
  conversationId: row.conversationId,
  role: row.role,
  content: row.content,
  createdAt: row.createdAt,
})

export function createSqliteMessageOps(db: DrizzleDB): MessageOps {
  return {
    async create(input: CreateMessageInput): Promise<Message> {
      const id = uuidv4()
      const now = new Date()
      await db.insert(messages).values({
        id,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        createdAt: now,
      })
      const [row] = await db.select().from(messages).where(eq(messages.id, id))
      return rowToMessage(row)
    },

    async findByConversationId(conversationId: string): Promise<Message[]> {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt))
      return rows.map(rowToMessage)
    },
  }
}
