/**
 * Project-specific Domain Errors
 */

import { DomainError } from "./base"

/** Invalid project ID (not a valid slug) */
export class InvalidProjectIdError extends DomainError {
  constructor(id: string) {
    super(
      `Invalid project ID '${id}'. Must be lowercase alphanumeric with hyphens, 1-100 characters.`,
      "INVALID_PROJECT_ID",
      400
    )
    this.name = "InvalidProjectIdError"
  }
}
