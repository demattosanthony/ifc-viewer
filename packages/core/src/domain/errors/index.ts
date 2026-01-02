// Base error class
export { DomainError, isDomainError } from "./base"

// Common errors
export { NotFoundError, DuplicateError, ValidationError } from "./common"

// Entity-specific errors
export { InvalidProjectIdError } from "./project.errors"
