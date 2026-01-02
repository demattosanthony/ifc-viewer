/**
 * DTOs (Data Transfer Objects)
 *
 * Framework-agnostic Zod schemas for request/response validation.
 * These can be used with any HTTP framework (Elysia, Express, Hono, etc.)
 */

// Common
export {
  ErrorResponse,
  SuccessResponse,
  SuccessWithPathResponse,
  ApiInfoResponse,
  HealthResponse,
  PaginationQuery,
  PaginatedResponse,
} from "./common.dto"

// Project
export {
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectIdParam,
  ProjectResponse,
  ProjectListResponse,
} from "./project.dto"

// Workspace
export {
  CreateWorkspaceRequest,
  WorkspaceIdParam,
  WorkspaceResponse,
  WorkspaceListResponse,
} from "./workspace.dto"

// Agent
export {
  ChatHistoryMessage,
  StartChatRequest,
  MessageResponse,
  ConversationResponse,
  ConversationWithMessagesResponse,
} from "./agent.dto"

// Files
export {
  FileEntryType,
  FileEntry,
  FileContentType,
  ListFilesQuery,
  ReadFileQuery,
  WriteFileRequest,
  DeleteFileQuery,
  CreateDirectoryRequest,
  ListFilesResponse,
  ReadFileResponse,
} from "./files.dto"
