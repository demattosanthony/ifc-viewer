/**
 * Domain Layer
 *
 * Contains entities, value objects, and domain errors.
 */

// Entities
export {
  // Conversation
  type Conversation,
  ConversationSchema,
  type ConversationStatus,
  ConversationStatusSchema,
  createProject,
  getModelStorageKey,
  inferDiscipline,
  isAssistantMessage,
  isConversationActive,
  isSystemMessage,
  isUserMessage,
  isValidProjectId,
  // Message
  type Message,
  type MessageRole,
  MessageRoleSchema,
  MessageSchema,
  // Model
  type Model,
  type ModelDiscipline,
  ModelDisciplineSchema,
  ModelSchema,
  // Project
  type Project,
  ProjectSchema,
} from "./entities"
// Errors
export * from "./errors"

// Agent types (value objects)
export type {
  AgentMessage,
  AgentMessageRole,
  MessagePart,
  Position,
  Range,
  TextPart,
  ToolInvocation,
  ToolInvocationState,
  ToolPart,
  UsageStats,
} from "./value-objects"
// Value Objects
export { Slug } from "./value-objects"
