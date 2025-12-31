import type { SessionRepository } from "../repositories/session-repository";
import type { ConversationRepository } from "../repositories/conversation-repository";
import type { SessionStatus } from "../entities/session";
import type { ConversationStatus } from "../entities/conversation";

// ============================================================================
// Repository Provider - interface that DatabaseProvider satisfies
// ============================================================================

export interface RepositoryProvider {
  sessions: SessionRepository;
  conversations: ConversationRepository;
}

// ============================================================================
// Configuration
// ============================================================================

export interface IFCViewerClientConfig {
  db: RepositoryProvider;
  defaultWorkingDirectory: string;
  defaultSessionTtlMs?: number;
}

// ============================================================================
// Output DTOs
// ============================================================================

export interface SessionOutput {
  id: string;
  workingDirectory: string;
  createdAt: string;
  expiresAt: string;
  status: SessionStatus;
  metadata?: Record<string, unknown>;
}

export interface MessageOutput {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ConversationOutput {
  id: string;
  sessionId: string;
  messages: MessageOutput[];
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
}
