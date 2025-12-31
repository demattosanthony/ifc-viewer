import type { SessionRepository } from "../repositories/session-repository";
import type { CreateSessionInput } from "../entities/session";
import { getSessionStatus } from "../entities/session";
import { SessionNotFoundError } from "../errors";
import type { SessionOutput } from "./types";

export interface SessionsClient {
  create(input?: Partial<CreateSessionInput>): Promise<SessionOutput>;
  get(id: string): Promise<SessionOutput | null>;
  getOrThrow(id: string): Promise<SessionOutput>;
  list(): Promise<SessionOutput[]>;
  delete(id: string): Promise<void>;
  touch(id: string): Promise<SessionOutput>;
}

export interface SessionsClientConfig {
  repository: SessionRepository;
  defaultWorkingDirectory: string;
  defaultTtlMs: number;
}

export function createSessionsClient(config: SessionsClientConfig): SessionsClient {
  const { repository, defaultWorkingDirectory, defaultTtlMs } = config;

  const format = (session: {
    id: string;
    workingDirectory: string;
    createdAt: Date;
    expiresAt: Date;
    metadata?: Record<string, unknown>;
  }): SessionOutput => ({
    id: session.id,
    workingDirectory: session.workingDirectory,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    status: getSessionStatus(session),
    metadata: session.metadata,
  });

  return {
    async create(input = {}) {
      const session = await repository.create({
        workingDirectory: input.workingDirectory ?? defaultWorkingDirectory,
        ttlMs: input.ttlMs ?? defaultTtlMs,
        metadata: input.metadata,
      });
      return format(session);
    },

    async get(id) {
      const session = await repository.findById(id);
      return session ? format(session) : null;
    },

    async getOrThrow(id) {
      const session = await repository.findById(id);
      if (!session) throw new SessionNotFoundError(id);
      return format(session);
    },

    async list() {
      const sessions = await repository.findAll();
      return sessions.map(format);
    },

    async delete(id) {
      const exists = await repository.exists(id);
      if (!exists) throw new SessionNotFoundError(id);
      await repository.delete(id);
    },

    async touch(id) {
      const session = await repository.findById(id);
      if (!session) throw new SessionNotFoundError(id);
      await repository.touch(id, defaultTtlMs);
      const updated = await repository.findById(id);
      return format(updated!);
    },
  };
}
