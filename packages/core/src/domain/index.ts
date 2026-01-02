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
  // Workspace
  type Workspace,
  type WorkspaceStatus,
  WorkspaceSchema,
  WorkspaceStatusSchema,
  isWorkspaceActive,
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
} from "./entities"

// Value Objects
export { Slug } from "./value-objects"

// Errors
export * from "./errors"
