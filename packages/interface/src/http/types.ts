/**
 * HTTP Controller Types
 *
 * Framework-agnostic types for HTTP controller responses.
 */

/** Successful HTTP result */
export type HttpSuccess<T> = {
  success: true
  data: T
  status: number
}

/** Failed HTTP result */
export type HttpError = {
  success: false
  error: string
  status: number
}

/** HTTP result union type */
export type HttpResult<T> = HttpSuccess<T> | HttpError

/** Helper to create a success result */
export function ok<T>(data: T, status = 200): HttpSuccess<T> {
  return { success: true, data, status }
}

/** Helper to create an error result */
export function err(error: string, status = 400): HttpError {
  return { success: false, error, status }
}

/** Helper to create a not found error */
export function notFound(message: string): HttpError {
  return { success: false, error: message, status: 404 }
}

/** Helper to create a server error */
export function serverError(message: string): HttpError {
  return { success: false, error: message, status: 500 }
}
