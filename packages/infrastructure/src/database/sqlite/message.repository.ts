import type { Message, MessageRepository } from "@ifc-viewer/core"
import { generateId, MessageSchema } from "@ifc-viewer/core"
import { asc, eq } from "drizzle-orm"

import type { DrizzleDB, DrizzleTransaction } from "./db"
import { createMessagePartRepository } from "./message-part.repository"
import { messages } from "./schema"

export function createMessageRepository(db: DrizzleDB | DrizzleTransaction): MessageRepository {
  const partsRepo = createMessagePartRepository(db)

  return {
    async create(input: Message.CreateInput): Promise<Message> {
      const id = generateId()
      const now = new Date()

      await db.insert(messages).values({
        id,
        conversationId: input.conversationId,
        role: input.role,
        createdAt: now,
      })

      await partsRepo.createMany(id, input.parts)

      return MessageSchema.parse({
        id,
        conversationId: input.conversationId,
        role: input.role,
        parts: input.parts,
        createdAt: now,
      })
    },

    async findByConversationId(conversationId: string): Promise<Message[]> {
      const messageRows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt))

      if (messageRows.length === 0) return []

      const messageIds = messageRows.map((m) => m.id)
      const partsMap = await partsRepo.findByMessageIds(messageIds)

      return messageRows.map((row) =>
        MessageSchema.parse({
          id: row.id,
          conversationId: row.conversationId,
          role: row.role,
          parts: partsMap.get(row.id) ?? [],
          createdAt: row.createdAt,
        })
      )
    },
  }
}
