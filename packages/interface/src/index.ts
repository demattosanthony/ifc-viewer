/**
 * @ifc-viewer/interface
 *
 * Interface adapters layer for the IFC Viewer platform.
 *
 * ## Architecture
 *
 * This package implements the Interface Adapters layer (Driving/Primary Adapters)
 * from Clean Architecture / Hexagonal Architecture:
 *
 * - dto/         - Data Transfer Objects (Zod schemas for request/response)
 * - http/        - HTTP controllers (framework-agnostic)
 *
 * ## Usage Pattern
 *
 * DTOs are Zod schemas that work directly with Elysia (and other frameworks):
 *
 * ```ts
 * import { CreateProjectRequest, ProjectResponse } from "@ifc-viewer/interface"
 *
 * // In Elysia route - Zod schemas work directly
 * .post("/", handler, {
 *   body: CreateProjectRequest,
 *   response: { 200: ProjectResponse }
 * })
 * ```
 *
 * Controllers encapsulate business logic and return framework-agnostic results:
 *
 * ```ts
 * import { ProjectController } from "@ifc-viewer/interface"
 *
 * const controller = new ProjectController(ctx)
 * const result = await controller.create(body)
 *
 * if (result.success) {
 *   return result.data
 * } else {
 *   set.status = result.status
 *   return { error: result.error }
 * }
 * ```
 */

// DTOs
export {
  // Common
  ErrorResponse,
  SuccessResponse,
  SuccessWithPathResponse,
  ApiInfoResponse,
  HealthResponse,
  PaginationQuery,
  PaginatedResponse,
  // Project
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectIdParam,
  ProjectResponse,
  ProjectListResponse,
  // Conversations
  CreateConversationRequest,
  SendMessageRequest,
  SendMessageResponse,
  MessageResponse,
  ConversationResponse,
  ConversationListResponse,
  ConversationWithMessagesResponse,
  // Files
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
  // Models
  UploadModelRequest,
  UpdateModelRequest,
  ModelIdParam,
  ProjectModelParams,
  ModelResponse,
  ModelListResponse,
  UploadModelResponse,
} from "./dto"

// HTTP
export {
  // Types
  type HttpResult,
  type HttpSuccess,
  type HttpError,
  ok,
  err,
  notFound,
  serverError,
  // Controllers
  ProjectController,
  ProjectFilesController,
  ConversationController,
  AgentController,
  ModelController,
  // SSE utilities
  createSSEStream,
  sseResponse,
  type SSEContext,
  type SSEStreamOptions,
} from "./http"
