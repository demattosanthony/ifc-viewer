/**
 * Core session entity representing a workspace session
 */
export interface Session {
  /** Unique session identifier */
  id: string;
  /** Working directory for file operations */
  workingDirectory: string;
  /** When the session was created */
  createdAt: Date;
  /** When the session will expire and be cleaned up */
  expiresAt: Date;
  /** Optional metadata for session */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a new session
 */
export interface CreateSessionInput {
  /** Override the default working directory */
  workingDirectory?: string;
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttlMs?: number;
  /** Optional metadata to attach to session */
  metadata?: Record<string, unknown>;
}

/**
 * Session with its associated resources (terminals, etc.)
 */
export interface SessionWithResources extends Session {
  /** IDs of active terminals in this session */
  terminalIds: string[];
  /** Whether this session has a dedicated agent terminal */
  hasAgentTerminal: boolean;
}

/**
 * Session status for monitoring
 */
export type SessionStatus = "active" | "expiring" | "expired";

/**
 * Calculate session status based on expiry time
 */
export function getSessionStatus(session: Session): SessionStatus {
  const now = new Date();
  const timeUntilExpiry = session.expiresAt.getTime() - now.getTime();

  if (timeUntilExpiry <= 0) {
    return "expired";
  }

  // Session is "expiring" if less than 1 minute remaining
  if (timeUntilExpiry < 60_000) {
    return "expiring";
  }

  return "active";
}
