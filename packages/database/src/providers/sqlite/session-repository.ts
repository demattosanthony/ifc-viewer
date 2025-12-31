import { eq, and } from "drizzle-orm";
import type {
  Session,
  CreateSessionInput,
  SessionWithResources,
  SessionRepository,
  SessionRepositoryEvents,
} from "@ifc-viewer/core";
import { sessions, sessionTerminals } from "./schema";
import type { DrizzleDB } from "./db";

export interface SQLiteSessionRepositoryConfig {
  db: DrizzleDB;
  defaultWorkingDirectory: string;
  defaultTtlMs?: number;
  events?: SessionRepositoryEvents;
}

export class SQLiteSessionRepository implements SessionRepository {
  private readonly db: DrizzleDB;
  private readonly config: {
    defaultWorkingDirectory: string;
    defaultTtlMs: number;
    events?: SessionRepositoryEvents;
  };
  private expiryTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(config: SQLiteSessionRepositoryConfig) {
    this.db = config.db;
    this.config = {
      defaultWorkingDirectory: config.defaultWorkingDirectory,
      defaultTtlMs: config.defaultTtlMs ?? 5 * 60 * 1000,
      events: config.events,
    };
  }

  private generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private scheduleExpiry(session: Session): void {
    // Clear existing timeout
    const existing = this.expiryTimeouts.get(session.id);
    if (existing) clearTimeout(existing);

    const timeUntilExpiry = session.expiresAt.getTime() - Date.now();

    if (timeUntilExpiry <= 0) {
      this.handleExpiry(session.id);
      return;
    }

    const timeout = setTimeout(() => {
      this.handleExpiry(session.id);
    }, timeUntilExpiry);

    this.expiryTimeouts.set(session.id, timeout);
  }

  private async handleExpiry(sessionId: string): Promise<void> {
    this.expiryTimeouts.delete(sessionId);
    await this.config.events?.onSessionExpired?.(sessionId);
    await this.delete(sessionId);
  }

  private rowToSession(row: {
    id: string;
    workingDirectory: string;
    createdAt: Date;
    expiresAt: Date;
    metadata: Record<string, unknown> | null;
  }): Session {
    return {
      id: row.id,
      workingDirectory: row.workingDirectory,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      metadata: row.metadata ?? undefined,
    };
  }

  async create(input: CreateSessionInput): Promise<Session> {
    const now = new Date();
    const ttlMs = input.ttlMs ?? this.config.defaultTtlMs;
    const id = this.generateId();

    const session: Session = {
      id,
      workingDirectory: input.workingDirectory ?? this.config.defaultWorkingDirectory,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      metadata: input.metadata,
    };

    await this.db.insert(sessions).values({
      id: session.id,
      workingDirectory: session.workingDirectory,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      metadata: session.metadata,
    });

    this.scheduleExpiry(session);
    await this.config.events?.onSessionCreated?.(session);

    return session;
  }

  async findById(id: string): Promise<Session | null> {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    return this.rowToSession(rows[0]);
  }

  async findAll(): Promise<Session[]> {
    const rows = await this.db.select().from(sessions);
    return rows.map((row) => this.rowToSession(row));
  }

  async delete(id: string): Promise<void> {
    const timeout = this.expiryTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.expiryTimeouts.delete(id);
    }

    await this.db.delete(sessions).where(eq(sessions.id, id));
    await this.config.events?.onSessionDeleted?.(id);
  }

  async updateExpiry(id: string, expiresAt: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ expiresAt })
      .where(eq(sessions.id, id));

    const session = await this.findById(id);
    if (session) {
      this.scheduleExpiry(session);
    }
  }

  async touch(id: string, ttlMs: number): Promise<void> {
    const newExpiresAt = new Date(Date.now() + ttlMs);
    await this.updateExpiry(id, newExpiresAt);
  }

  async addTerminal(sessionId: string, terminalId: string): Promise<void> {
    await this.db
      .insert(sessionTerminals)
      .values({ sessionId, terminalId, isAgentTerminal: false })
      .onConflictDoNothing();
  }

  async removeTerminal(sessionId: string, terminalId: string): Promise<void> {
    await this.db
      .delete(sessionTerminals)
      .where(
        and(
          eq(sessionTerminals.sessionId, sessionId),
          eq(sessionTerminals.terminalId, terminalId)
        )
      );
  }

  async setAgentTerminal(
    sessionId: string,
    terminalId: string | null
  ): Promise<void> {
    // Clear existing agent terminal
    await this.db
      .update(sessionTerminals)
      .set({ isAgentTerminal: false })
      .where(eq(sessionTerminals.sessionId, sessionId));

    if (terminalId) {
      // Upsert the terminal and mark as agent
      await this.db
        .insert(sessionTerminals)
        .values({ sessionId, terminalId, isAgentTerminal: true })
        .onConflictDoUpdate({
          target: [sessionTerminals.sessionId, sessionTerminals.terminalId],
          set: { isAgentTerminal: true },
        });
    }
  }

  async getWithResources(id: string): Promise<SessionWithResources | null> {
    const session = await this.findById(id);
    if (!session) return null;

    const terminals = await this.db
      .select()
      .from(sessionTerminals)
      .where(eq(sessionTerminals.sessionId, id));

    return {
      ...session,
      terminalIds: terminals.map((t) => t.terminalId),
      hasAgentTerminal: terminals.some((t) => t.isAgentTerminal),
    };
  }

  async exists(id: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Initialize expiry timeouts for existing sessions
   * Call this after creating the repository to restore timers
   */
  async initializeExpiryTimers(): Promise<void> {
    const allSessions = await this.findAll();
    for (const session of allSessions) {
      this.scheduleExpiry(session);
    }
  }

  /**
   * Dispose all timers
   */
  async disposeAll(): Promise<void> {
    for (const timeout of this.expiryTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.expiryTimeouts.clear();
  }
}
