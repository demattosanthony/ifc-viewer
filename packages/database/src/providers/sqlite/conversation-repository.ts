import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  type Conversation,
  type ConversationRepository,
  type CreateConversationInput,
  type UpdateConversationInput,
  createConversation,
} from "@ifc-viewer/core";
import { conversations, type ConversationRow } from "./schema";
import type { DrizzleDB } from "./db";

function rowToConversation(row: ConversationRow): Conversation {
  return createConversation({
    id: row.id,
    workspaceId: row.workspaceId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function createSqliteConversationRepository(
  db: DrizzleDB
): ConversationRepository {
  return {
    async create(input: CreateConversationInput): Promise<Conversation> {
      const now = new Date();
      const id = uuidv4();

      await db.insert(conversations).values({
        id,
        workspaceId: input.workspaceId,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const [row] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id));

      return rowToConversation(row);
    },

    async findActiveByWorkspaceId(workspaceId: string): Promise<Conversation | null> {
      const [row] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.workspaceId, workspaceId),
            eq(conversations.status, "active")
          )
        );

      return row ? rowToConversation(row) : null;
    },

    async update(id: string, input: UpdateConversationInput): Promise<Conversation> {
      const updates: Partial<ConversationRow> = {
        updatedAt: new Date(),
      };

      if (input.status !== undefined) updates.status = input.status;

      await db.update(conversations).set(updates).where(eq(conversations.id, id));

      const [row] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id));

      return rowToConversation(row);
    },

    async deleteByWorkspaceId(workspaceId: string): Promise<void> {
      await db.delete(conversations).where(eq(conversations.workspaceId, workspaceId));
    },
  };
}
