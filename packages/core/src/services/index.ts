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
  getWorkspaceWithCompute,
  stopWorkspaceWithSync,
  deleteWorkspace,
  type CreateWorkspaceInput,
} from "./workspace.service"

export {
  normalizeStoragePath,
  buildStorageKey,
  deleteStoragePrefix,
  createStorageSyncCallbacks,
  type StorageSyncOptions,
  type StorageSyncCallbacks,
} from "./storage-sync"

export {
  runAgentChat,
  type AgentChatInput,
  type AgentChatResult,
} from "./agent.service"
