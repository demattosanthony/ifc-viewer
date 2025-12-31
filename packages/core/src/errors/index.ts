export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "DomainError";
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

export class ProjectNotFoundError extends DomainError {
  constructor(projectId: string) {
    super(`Project ${projectId} not found`, "PROJECT_NOT_FOUND", 404);
    this.name = "ProjectNotFoundError";
  }
}

export class WorkspaceNotFoundError extends DomainError {
  constructor(workspaceId: string) {
    super(`Workspace ${workspaceId} not found`, "WORKSPACE_NOT_FOUND", 404);
    this.name = "WorkspaceNotFoundError";
  }
}

export class ConversationNotFoundError extends DomainError {
  constructor(conversationId: string) {
    super(
      `Conversation ${conversationId} not found`,
      "CONVERSATION_NOT_FOUND",
      404
    );
    this.name = "ConversationNotFoundError";
  }
}

export class MessageNotFoundError extends DomainError {
  constructor(messageId: string) {
    super(`Message ${messageId} not found`, "MESSAGE_NOT_FOUND", 404);
    this.name = "MessageNotFoundError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
