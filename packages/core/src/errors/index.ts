/**
 * Base error class for domain errors
 */
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

export class SessionExpiredError extends DomainError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} has expired`, "SESSION_EXPIRED", 410);
    this.name = "SessionExpiredError";
  }
}

export class FileNotFoundError extends DomainError {
  constructor(path: string) {
    super(`File not found: ${path}`, "FILE_NOT_FOUND", 404);
    this.name = "FileNotFoundError";
  }
}

export class DirectoryNotFoundError extends DomainError {
  constructor(path: string) {
    super(`Directory not found: ${path}`, "DIRECTORY_NOT_FOUND", 404);
    this.name = "DirectoryNotFoundError";
  }
}

export class FileOperationError extends DomainError {
  constructor(operation: string, path: string, reason?: string) {
    const message = reason
      ? `Failed to ${operation} ${path}: ${reason}`
      : `Failed to ${operation} ${path}`;
    super(message, "FILE_OPERATION_FAILED", 500);
    this.name = "FileOperationError";
  }
}

export class TerminalNotFoundError extends DomainError {
  constructor(terminalId: string) {
    super(`Terminal ${terminalId} not found`, "TERMINAL_NOT_FOUND", 404);
    this.name = "TerminalNotFoundError";
  }
}

export class TerminalError extends DomainError {
  constructor(message: string) {
    super(message, "TERMINAL_ERROR", 500);
    this.name = "TerminalError";
  }
}

export class SandboxError extends DomainError {
  constructor(message: string) {
    super(message, "SANDBOX_ERROR", 500);
    this.name = "SandboxError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
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

export class ConversationError extends DomainError {
  constructor(message: string) {
    super(message, "CONVERSATION_ERROR", 500);
    this.name = "ConversationError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
