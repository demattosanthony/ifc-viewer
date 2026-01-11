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
  isConversationActive,
  isValidProjectId,
  // Message
  type Message,
  type MessagePart,
  MessagePartSchema,
  type MessagePartText,
  MessagePartTextSchema,
  type MessagePartToolUse,
  MessagePartToolUseSchema,
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
  type ToolUseStatus,
  ToolUseStatusSchema,
} from "./entities"
// Errors
export * from "./errors"
// Value Objects
export { Slug } from "./value-objects"
