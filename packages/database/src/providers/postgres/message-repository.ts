import { eq, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { Message, Database } from "@ifc-viewer/core";
import { messages } from "./schema";
import type { DrizzleDB } from "./db";

const rowToEntity = (row: typeof messages.$inferSelect): Message.Entity => ({
  id: row.id,
  conversationId: row.conversationId,
  role: row.role,
  content: row.content,
  createdAt: row.createdAt,
});

export function createMessageRepository(db: DrizzleDB): Database.MessageRepository {
  return {
    async create(input: Message.CreateInput): Promise<Message.Entity> {
      const id = uuidv4();
      const now = new Date();
      await db.insert(messages).values({
        id,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        createdAt: now,
      });
      const [row] = await db.select().from(messages).where(eq(messages.id, id));
      return rowToEntity(row);
    },

    async findByConversationId(conversationId: string): Promise<Message.Entity[]> {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt));
      return rows.map(rowToEntity);
    },
  };
}
