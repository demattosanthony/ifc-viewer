import { createProjectsClient, type ProjectsClient } from "./projects";
import { createWorkspacesClient, type WorkspacesClient } from "./workspaces";
import { createConversationsClient, type ConversationsClient } from "./conversations";
import { createMessagesClient, type MessagesClient } from "./messages";
import type { IFCViewerClientConfig } from "./types";

export interface IFCViewerClient {
  projects: ProjectsClient;
  workspaces: WorkspacesClient;
  conversations: ConversationsClient;
  messages: MessagesClient;
  dispose(): Promise<void>;
}

export function createClient(config: IFCViewerClientConfig): IFCViewerClient {
  const projects = createProjectsClient({
    repository: config.db.projects,
  });

  const workspaces = createWorkspacesClient({
    repository: config.db.workspaces,
  });

  const conversations = createConversationsClient({
    repository: config.db.conversations,
  });

  const messages = createMessagesClient({
    repository: config.db.messages,
  });

  return {
    projects,
    workspaces,
    conversations,
    messages,
    async dispose() {},
  };
}
