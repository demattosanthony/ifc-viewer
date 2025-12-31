import { eq, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  type Message,
  type MessageRepository,
  type CreateMessageInput,
  createMessage,
} from "@ifc-viewer/core";
import { messages } from "./schema";
import type { DrizzleDB } from "./db";

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

      return createMessage({
        id: row.id,
        conversationId: row.conversationId,
        role: row.role,
        content: row.content,
        createdAt: row.createdAt,
      });
    },

    async findByConversationId(conversationId: string): Promise<Message[]> {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt));

      return rows.map((row) =>
        createMessage({
          id: row.id,
          conversationId: row.conversationId,
          role: row.role,
          content: row.content,
          createdAt: row.createdAt,
        })
      );
    },
  };
}
