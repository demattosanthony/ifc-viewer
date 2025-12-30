import type {
  Session,
  CreateSessionInput,
  SessionWithResources,
} from "../entities/session";

/**
 * Repository interface for session management
 * Implementations can use different storage backends (memory, postgres, etc.)
 */
export interface SessionRepository {
  /**
   * Create a new session
   */
  create(input: CreateSessionInput): Promise<Session>;

  /**
   * Find a session by ID
   * @returns The session or null if not found
   */
  findById(id: string): Promise<Session | null>;

  /**
   * Find all active sessions
   */
  findAll(): Promise<Session[]>;

  /**
   * Delete a session by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Update session expiry time
   */
  updateExpiry(id: string, expiresAt: Date): Promise<void>;

  /**
   * Touch session to extend its expiry (heartbeat)
   * @param ttlMs Time-to-live extension in milliseconds
   */
  touch(id: string, ttlMs: number): Promise<void>;

  // Terminal tracking methods

  /**
   * Add a terminal to a session
   */
  addTerminal(sessionId: string, terminalId: string): Promise<void>;

  /**
   * Remove a terminal from a session
   */
  removeTerminal(sessionId: string, terminalId: string): Promise<void>;

  /**
   * Set or clear the agent terminal for a session
   */
  setAgentTerminal(sessionId: string, terminalId: string | null): Promise<void>;

  /**
   * Get session with all its resources
   */
  getWithResources(id: string): Promise<SessionWithResources | null>;

  /**
   * Check if a session exists
   */
  exists(id: string): Promise<boolean>;
}

/**
 * Events emitted by the session repository
 */
export interface SessionRepositoryEvents {
  /**
   * Called when a session is about to expire
   */
  onSessionExpiring?: (session: Session) => void | Promise<void>;

  /**
   * Called when a session has expired and should be cleaned up
   */
  onSessionExpired?: (sessionId: string) => void | Promise<void>;

  /**
   * Called when a session is created
   */
  onSessionCreated?: (session: Session) => void | Promise<void>;

  /**
   * Called when a session is deleted
   */
  onSessionDeleted?: (sessionId: string) => void | Promise<void>;
}
