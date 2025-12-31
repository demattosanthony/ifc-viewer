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

export class SessionNotFoundError extends DomainError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`, "SESSION_NOT_FOUND", 404);
    this.name = "SessionNotFoundError";
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

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
