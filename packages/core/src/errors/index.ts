/**
 * Base error class for domain errors
 * Provides consistent error handling with HTTP status codes
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "DomainError";
    // Maintains proper stack trace for where error was thrown (V8 only)
    if ("captureStackTrace" in Error) {
      (Error as { captureStackTrace: (target: Error, constructor: Function) => void })
        .captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

/**
 * Thrown when a session cannot be found
 */
export class SessionNotFoundError extends DomainError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`, "SESSION_NOT_FOUND", 404);
    this.name = "SessionNotFoundError";
  }
}

/**
 * Thrown when a session has expired
 */
export class SessionExpiredError extends DomainError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} has expired`, "SESSION_EXPIRED", 410);
    this.name = "SessionExpiredError";
  }
}

/**
 * Thrown when a file cannot be found
 */
export class FileNotFoundError extends DomainError {
  constructor(path: string) {
    super(`File not found: ${path}`, "FILE_NOT_FOUND", 404);
    this.name = "FileNotFoundError";
  }
}

/**
 * Thrown when a directory cannot be found
 */
export class DirectoryNotFoundError extends DomainError {
  constructor(path: string) {
    super(`Directory not found: ${path}`, "DIRECTORY_NOT_FOUND", 404);
    this.name = "DirectoryNotFoundError";
  }
}

/**
 * Thrown when file operation fails
 */
export class FileOperationError extends DomainError {
  constructor(operation: string, path: string, reason?: string) {
    const message = reason
      ? `Failed to ${operation} ${path}: ${reason}`
      : `Failed to ${operation} ${path}`;
    super(message, "FILE_OPERATION_FAILED", 500);
    this.name = "FileOperationError";
  }
}

/**
 * Thrown when a terminal cannot be found
 */
export class TerminalNotFoundError extends DomainError {
  constructor(terminalId: string) {
    super(`Terminal ${terminalId} not found`, "TERMINAL_NOT_FOUND", 404);
    this.name = "TerminalNotFoundError";
  }
}

/**
 * Thrown when terminal operation fails
 */
export class TerminalError extends DomainError {
  constructor(message: string) {
    super(message, "TERMINAL_ERROR", 500);
    this.name = "TerminalError";
  }
}

/**
 * Thrown when a sandbox cannot be created or found
 */
export class SandboxError extends DomainError {
  constructor(message: string) {
    super(message, "SANDBOX_ERROR", 500);
    this.name = "SandboxError";
  }
}

/**
 * Thrown for validation errors
 */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

/**
 * Type guard to check if an error is a DomainError
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
