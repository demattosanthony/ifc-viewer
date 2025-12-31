import { eq } from "drizzle-orm";
import type {
  Conversation,
  ConversationMessage,
  ConversationStatus,
  CreateConversationInput,
  AddMessageInput,
  ConversationRepository,
} from "@ifc-viewer/core";
import { conversations, messages } from "./schema";
import type { DrizzleDB } from "./db";

export interface SQLiteConversationRepositoryConfig {
  db: DrizzleDB;
}

export class SQLiteConversationRepository implements ConversationRepository {
  private readonly db: DrizzleDB;

  constructor(config: SQLiteConversationRepositoryConfig) {
    this.db = config.db;
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  async create(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date();
    const id = this.generateId("conv");

    await this.db.insert(conversations).values({
      id,
      sessionId: input.sessionId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      sessionId: input.sessionId,
      messages: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
  }

  async findById(id: string): Promise<Conversation | null> {
    const rows = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    const msgs = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id));

    return {
      id: row.id,
      sessionId: row.sessionId,
      status: row.status as ConversationStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      messages: msgs.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  }

  async findBySessionId(sessionId: string): Promise<Conversation | null> {
    const rows = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.sessionId, sessionId))
      .limit(1);

    if (rows.length === 0) return null;
    return this.findById(rows[0].id);
  }

  async findAllBySessionId(sessionId: string): Promise<Conversation[]> {
    const rows = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.sessionId, sessionId));

    const results: Conversation[] = [];
    for (const row of rows) {
      const conv = await this.findById(row.id);
      if (conv) results.push(conv);
    }
    return results;
  }

  async addMessage(
    conversationId: string,
    input: AddMessageInput
  ): Promise<ConversationMessage> {
    const id = this.generateId("msg");
    const now = new Date();

    await this.db.insert(messages).values({
      id,
      conversationId,
      role: input.role,
      content: input.content,
      createdAt: now,
    });

    await this.db
      .update(conversations)
      .set({ updatedAt: now })
      .where(eq(conversations.id, conversationId));

    return {
      id,
      role: input.role,
      content: input.content,
      createdAt: now,
    };
  }

  async updateStatus(id: string, status: ConversationStatus): Promise<void> {
    await this.db
      .update(conversations)
      .set({ status, updatedAt: new Date() })
      .where(eq(conversations.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(conversations).where(eq(conversations.id, id));
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await this.db
      .delete(conversations)
      .where(eq(conversations.sessionId, sessionId));
  }

  async exists(id: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    return rows.length > 0;
  }

  async disposeAll(): Promise<void> {
    // No timers to clean up for conversations
  }
}
