import { createSessionsClient, type SessionsClient } from "./sessions";
import { createConversationsClient, type ConversationsClient } from "./conversations";
import type { IFCViewerClientConfig } from "./types";

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface IFCViewerClient {
  sessions: SessionsClient;
  conversations: ConversationsClient;
  dispose(): Promise<void>;
}

export function createClient(config: IFCViewerClientConfig): IFCViewerClient {
  const sessions = createSessionsClient({
    repository: config.db.sessions,
    defaultWorkingDirectory: config.defaultWorkingDirectory,
    defaultTtlMs: config.defaultSessionTtlMs ?? DEFAULT_TTL_MS,
  });

  const conversations = createConversationsClient({
    repository: config.db.conversations,
  });

  return {
    sessions,
    conversations,
    async dispose() {},
  };
}
