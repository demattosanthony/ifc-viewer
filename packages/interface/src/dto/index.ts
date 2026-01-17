/**
 * DTOs (Data Transfer Objects)
 *
 * Framework-agnostic Zod schemas for request/response validation.
 * These can be used with any HTTP framework (Elysia, Express, Hono, etc.)
 */

export type {
  AgentApproveToolMessage,
  AgentChatMessage,
  AgentClientMessage,
  AgentRejectToolMessage,
  AgentStopMessage,
  TerminalClientMessage,
  TerminalDataEvent,
  TerminalErrorEvent,
  TerminalExitEvent,
  TerminalInputMessage,
  TerminalReadyEvent,
  TerminalResizeMessage,
  TerminalServerEvent,
} from "./agent.dto"
// Conversations
export {
  ConversationListResponse,
  ConversationResponse,
  ConversationWithMessages,
  ConversationWithMessagesResponse,
  CreateConversationRequest,
  MessageResponse,
  SendMessageRequest,
  SendMessageResponse,
  ViewerResultRequest,
} from "./agent.dto"
// Common
export {
  ApiInfoResponse,
  ErrorResponse,
  HealthResponse,
  PaginatedResponse,
  PaginationQuery,
  SuccessResponse,
  SuccessWithPathResponse,
} from "./common.dto"
// Files
export {
  ConfirmUploadRequest,
  CreateDirectoryRequest,
  DeleteFileQuery,
  FileContentType,
  FileEntry,
  FileEntryType,
  GetPresignedUrlRequest,
  GetPresignedUrlResponse,
  ListFilesQuery,
  ListFilesResponse,
  ReadFileQuery,
  ReadFileResponse,
  WriteFileRequest,
} from "./files.dto"
// Models
export {
  ModelIdParam,
  ModelListResponse,
  ModelResponse,
  ProjectModelParams,
  UpdateModelRequest,
  UploadModelRequest,
  UploadModelResponse,
} from "./model.dto"
// Project
export {
  CreateProjectRequest,
  ProjectIdParam,
  ProjectListResponse,
  ProjectResponse,
  UpdateProjectRequest,
} from "./project.dto"
