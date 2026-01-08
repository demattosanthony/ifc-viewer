/**
 * Domain Layer
 *
 * Contains entities, value objects, and domain errors.
 */

// Entities
export {
  // Project
  type Project,
  ProjectSchema,
  createProject,
  isValidProjectId,
  // Conversation
  type Conversation,
  type ConversationStatus,
  ConversationSchema,
  ConversationStatusSchema,
  isConversationActive,
  // Message
  type Message,
  type MessageRole,
  MessageSchema,
  MessageRoleSchema,
  isUserMessage,
  isAssistantMessage,
  isSystemMessage,
  // Model
  type Model,
  type ModelDiscipline,
  ModelSchema,
  ModelDisciplineSchema,
  getModelStorageKey,
  inferDiscipline,
} from "./entities"

// Value Objects
export { Slug } from "./value-objects"

// Agent types (value objects)
export type {
  Position,
  Range,
  UsageStats,
  TextPart,
  ToolInvocationState,
  ToolInvocation,
  ToolPart,
  MessagePart,
  AgentMessageRole,
  AgentMessage,
} from "./value-objects"

// Errors
export * from "./errors"
