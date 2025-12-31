import { eq, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  type Message,
  type MessageRepository,
  type CreateMessageInput,
  createMessage,
} from "@ifc-viewer/core";
import { messages, type MessageRow } from "./schema";
import type { DrizzleDB } from "./db";

function rowToMessage(row: MessageRow): Message {
  return createMessage({
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt,
  });
}

export function createSqliteMessageRepository(
  db: DrizzleDB
): MessageRepository {
  return {
    async create(input: CreateMessageInput): Promise<Message> {
      const now = new Date();
      const id = uuidv4();

      await db.insert(messages).values({
        id,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        createdAt: now,
      });

      const [row] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, id));

      return rowToMessage(row);
    },

    async findById(id: string): Promise<Message | null> {
      const [row] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, id));

      return row ? rowToMessage(row) : null;
    },

    async findByConversationId(conversationId: string): Promise<Message[]> {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt));

      return rows.map(rowToMessage);
    },

    async delete(id: string): Promise<void> {
      await db.delete(messages).where(eq(messages.id, id));
    },

    async deleteByConversationId(conversationId: string): Promise<void> {
      await db.delete(messages).where(eq(messages.conversationId, conversationId));
    },
  };
}
