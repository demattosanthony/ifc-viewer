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
} from "./dto"
// DTOs
export {
  ApiInfoResponse,
  ConfirmUploadRequest,
  ConversationListResponse,
  ConversationResponse,
  ConversationWithMessagesResponse,
  // Conversations
  CreateConversationRequest,
  CreateDirectoryRequest,
  // Project
  CreateProjectRequest,
  DeleteFileQuery,
  // Common
  ErrorResponse,
  FileContentType,
  FileEntry,
  // Files
  FileEntryType,
  GetPresignedUrlRequest,
  GetPresignedUrlResponse,
  HealthResponse,
  ListFilesQuery,
  ListFilesResponse,
  MessageResponse,
  ModelIdParam,
  ModelListResponse,
  ModelResponse,
  PaginatedResponse,
  PaginationQuery,
  ProjectIdParam,
  ProjectListResponse,
  ProjectModelParams,
  ProjectResponse,
  ReadFileQuery,
  ReadFileResponse,
  SendMessageRequest,
  SendMessageResponse,
  SuccessResponse,
  SuccessWithPathResponse,
  UpdateModelRequest,
  UpdateProjectRequest,
  // Models
  UploadModelRequest,
  UploadModelResponse,
  WriteFileRequest,
} from "./dto"

// HTTP
export {
  AgentController,
  ConversationController,
  // SSE utilities
  createSSEStream,
  err,
  type HttpError,
  // Types
  type HttpResult,
  type HttpSuccess,
  ModelController,
  notFound,
  ok,
  // Controllers
  ProjectController,
  ProjectFilesController,
  type SSEContext,
  type SSEStreamOptions,
  serverError,
  sseResponse,
} from "./http"
