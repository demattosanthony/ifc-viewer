import type { Message, MessageRepository } from "@ifc-viewer/core"
import { generateId, MessageSchema, NotFoundError } from "@ifc-viewer/core"
import { asc, eq } from "drizzle-orm"
import type { DrizzleDB, DrizzleTransaction } from "./db"
import { messages } from "./schema"

const rowToEntity = (row: typeof messages.$inferSelect): Message =>
  MessageSchema.parse({
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt,
  })

export function createMessageRepository(db: DrizzleDB | DrizzleTransaction): MessageRepository {
  return {
    async create(input: Message.CreateInput): Promise<Message> {
      const id = generateId()
      const now = new Date()
      await db.insert(messages).values({
        id,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        createdAt: now,
      })
      const [row] = await db.select().from(messages).where(eq(messages.id, id))
      if (!row) throw new NotFoundError("Message", id)
      return rowToEntity(row)
    },

    async findByConversationId(conversationId: string): Promise<Message[]> {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt))
      return rows.map(rowToEntity)
    },
  }
}
