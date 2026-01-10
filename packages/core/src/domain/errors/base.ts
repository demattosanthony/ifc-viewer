/**
 * Base Domain Error
 *
 * All domain-specific errors extend from this class.
 */

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

export const isDomainError = (error: unknown): error is DomainError => error instanceof DomainError
