/** Base error class for domain-specific errors */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message)
    this.name = "DomainError"
  }

  toJSON() {
    return {
      error: { code: this.code, message: this.message },
    }
  }
}

export const isDomainError = (error: unknown): error is DomainError =>
  error instanceof DomainError

/** Resource not found */
export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} '${id}' not found`, "NOT_FOUND", 404)
    this.name = "NotFoundError"
  }
}

/** Duplicate resource */
export class DuplicateError extends DomainError {
  constructor(resource: string, field: string) {
    super(`${resource} with this ${field} already exists`, "DUPLICATE", 409)
    this.name = "DuplicateError"
  }
}

/** Validation failed */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400)
    this.name = "ValidationError"
  }
}
