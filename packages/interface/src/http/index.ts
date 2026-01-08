/**
 * HTTP Layer
 *
 * Framework-agnostic HTTP controllers and types.
 */

// Types
export {
  type HttpResult,
  type HttpSuccess,
  type HttpError,
  ok,
  err,
  notFound,
  serverError,
} from "./types"

// Controllers
export {
  ProjectController,
  ProjectFilesController,
  ConversationController,
  AgentController,
  ModelController,
} from "./controllers"

// SSE utilities
export {
  createSSEStream,
  sseResponse,
  type SSEContext,
  type SSEStreamOptions,
} from "./sse"
