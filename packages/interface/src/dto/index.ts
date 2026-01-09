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

// Conversations
export {
  CreateConversationRequest,
  SendMessageRequest,
  SendMessageResponse,
  MessageResponse,
  ConversationResponse,
  ConversationListResponse,
  ConversationWithMessages,
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
  GetPresignedUrlRequest,
  GetPresignedUrlResponse,
  ConfirmUploadRequest,
} from "./files.dto"

// Models
export {
  UploadModelRequest,
  UpdateModelRequest,
  ModelIdParam,
  ProjectModelParams,
  ModelResponse,
  ModelListResponse,
  UploadModelResponse,
} from "./model.dto"
