// Base error class
export { DomainError, isDomainError } from "./base"

// Common errors
export { DuplicateError, NotFoundError, ValidationError } from "./common"

// Entity-specific errors
export { InvalidProjectIdError } from "./project.errors"
