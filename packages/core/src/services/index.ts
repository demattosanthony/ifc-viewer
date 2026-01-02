/**
 * Application Services
 *
 * Services that orchestrate between domain and infrastructure.
 * Only services with real business logic belong here.
 * Simple CRUD operations should call repositories directly.
 */

export {
  createProjectWithStorage,
  type CreateProjectInput,
} from "./project.service"

export {
  createWorkspaceWithFiles,
  type CreateWorkspaceInput,
} from "./workspace.service"

export {
  runAgentChat,
  type AgentChatInput,
  type AgentChatResult,
} from "./agent.service"
