import type {
  Session,
  CreateSessionInput,
  SessionWithResources,
  SessionRepository,
  SessionRepositoryEvents,
} from "@ifc-viewer/core";

/**
 * Internal session state that includes terminal tracking
 */
interface SessionState {
  session: Session;
  terminalIds: Set<string>;
  agentTerminalId: string | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

/**
 * Configuration for the memory session repository
 */
export interface MemorySessionRepositoryConfig {
  /** Default working directory for new sessions */
  defaultWorkingDirectory: string;
  /** Default TTL in milliseconds (default: 5 minutes) */
  defaultTtlMs?: number;
  /** Event handlers */
  events?: SessionRepositoryEvents;
}

/**
 * In-memory implementation of SessionRepository
 * Suitable for development and single-instance deployments
 */
export class MemorySessionRepository implements SessionRepository {
  private sessions = new Map<string, SessionState>();
  private readonly config: Required<
    Pick<MemorySessionRepositoryConfig, "defaultWorkingDirectory" | "defaultTtlMs">
  > & { events?: SessionRepositoryEvents };

  constructor(config: MemorySessionRepositoryConfig) {
    this.config = {
      defaultWorkingDirectory: config.defaultWorkingDirectory,
      defaultTtlMs: config.defaultTtlMs ?? 5 * 60 * 1000, // 5 minutes
      events: config.events,
    };
  }

  private generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
  }

  private scheduleExpiry(state: SessionState): void {
    // Clear existing timeout if any
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }

    const timeUntilExpiry = state.session.expiresAt.getTime() - Date.now();

    if (timeUntilExpiry <= 0) {
      // Already expired
      this.handleExpiry(state.session.id);
      return;
    }

    // Schedule expiry callback
    state.timeoutId = setTimeout(() => {
      this.handleExpiry(state.session.id);
    }, timeUntilExpiry);
  }

  private async handleExpiry(sessionId: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    // Notify about expiry
    await this.config.events?.onSessionExpired?.(sessionId);

    // Clean up
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }
    this.sessions.delete(sessionId);
  }

  async create(input: CreateSessionInput): Promise<Session> {
    const now = new Date();
    const ttlMs = input.ttlMs ?? this.config.defaultTtlMs;

    const session: Session = {
      id: this.generateId(),
      workingDirectory: input.workingDirectory ?? this.config.defaultWorkingDirectory,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      metadata: input.metadata,
    };

    const state: SessionState = {
      session,
      terminalIds: new Set(),
      agentTerminalId: null,
      timeoutId: null,
    };

    this.sessions.set(session.id, state);
    this.scheduleExpiry(state);

    await this.config.events?.onSessionCreated?.(session);

    return session;
  }

  async findById(id: string): Promise<Session | null> {
    const state = this.sessions.get(id);
    return state?.session ?? null;
  }

  async findAll(): Promise<Session[]> {
    return Array.from(this.sessions.values()).map((state) => state.session);
  }

  async delete(id: string): Promise<void> {
    const state = this.sessions.get(id);
    if (!state) return;

    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }

    this.sessions.delete(id);
    await this.config.events?.onSessionDeleted?.(id);
  }

  async updateExpiry(id: string, expiresAt: Date): Promise<void> {
    const state = this.sessions.get(id);
    if (!state) return;

    state.session = { ...state.session, expiresAt };
    this.scheduleExpiry(state);
  }

  async touch(id: string, ttlMs: number): Promise<void> {
    const state = this.sessions.get(id);
    if (!state) return;

    const newExpiresAt = new Date(Date.now() + ttlMs);
    await this.updateExpiry(id, newExpiresAt);
  }

  async addTerminal(sessionId: string, terminalId: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    state.terminalIds.add(terminalId);
  }

  async removeTerminal(sessionId: string, terminalId: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    state.terminalIds.delete(terminalId);

    // Clear agent terminal if this was it
    if (state.agentTerminalId === terminalId) {
      state.agentTerminalId = null;
    }
  }

  async setAgentTerminal(
    sessionId: string,
    terminalId: string | null
  ): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    state.agentTerminalId = terminalId;

    // Also add to terminal IDs if not null
    if (terminalId) {
      state.terminalIds.add(terminalId);
    }
  }

  async getWithResources(id: string): Promise<SessionWithResources | null> {
    const state = this.sessions.get(id);
    if (!state) return null;

    return {
      ...state.session,
      terminalIds: Array.from(state.terminalIds),
      hasAgentTerminal: state.agentTerminalId !== null,
    };
  }

  async exists(id: string): Promise<boolean> {
    return this.sessions.has(id);
  }

  /**
   * Get the agent terminal ID for a session
   */
  getAgentTerminalId(sessionId: string): string | null {
    const state = this.sessions.get(sessionId);
    return state?.agentTerminalId ?? null;
  }

  /**
   * Dispose all sessions and clear timeouts
   */
  async disposeAll(): Promise<void> {
    for (const [id, state] of this.sessions) {
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
      await this.config.events?.onSessionDeleted?.(id);
    }
    this.sessions.clear();
  }
}
