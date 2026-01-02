import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from "../schema/project"
import type {
  Workspace,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from "../schema/workspace"
import type {
  Conversation,
  CreateConversationInput,
  UpdateConversationInput,
} from "../schema/conversation"
import type { Message, CreateMessageInput } from "../schema/message"

/** Project persistence operations */
export type ProjectOps = {
  create(input: CreateProjectInput): Promise<Project>
  findById(id: string): Promise<Project | null>
  findAll(): Promise<Project[]>
  update(id: string, input: UpdateProjectInput): Promise<Project>
  delete(id: string): Promise<void>
}

/** Workspace persistence operations */
export type WorkspaceOps = {
  create(input: CreateWorkspaceInput): Promise<Workspace>
  findById(id: string): Promise<Workspace | null>
  findAll(): Promise<Workspace[]>
  findByProjectId(projectId: string): Promise<Workspace[]>
  findActive(): Promise<Workspace[]>
  update(id: string, input: UpdateWorkspaceInput): Promise<Workspace>
  delete(id: string): Promise<void>
  touch(id: string): Promise<Workspace>
}

/** Conversation persistence operations */
export type ConversationOps = {
  create(input: CreateConversationInput): Promise<Conversation>
  findActiveByWorkspaceId(workspaceId: string): Promise<Conversation | null>
  update(id: string, input: UpdateConversationInput): Promise<Conversation>
  deleteByWorkspaceId(workspaceId: string): Promise<void>
}

/** Message persistence operations */
export type MessageOps = {
  create(input: CreateMessageInput): Promise<Message>
  findByConversationId(conversationId: string): Promise<Message[]>
}

/** Combined database operations */
export type DatabaseOps = {
  projects: ProjectOps
  workspaces: WorkspaceOps
  conversations: ConversationOps
  messages: MessageOps
  dispose(): Promise<void>
}
