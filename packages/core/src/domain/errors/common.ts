/**
 * Common Domain Errors
 *
 * Shared error types used across multiple entities.
 */

import { DomainError } from "./base"

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
