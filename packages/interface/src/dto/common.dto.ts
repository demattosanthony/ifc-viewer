/**
 * Common DTOs
 *
 * Shared request/response schemas used across multiple controllers.
 */

import { z } from "zod"

// ============================================================================
// Response DTOs
// ============================================================================

/** Standard error response */
export const ErrorResponse = z.object({
  error: z.string(),
})
export type ErrorResponse = z.infer<typeof ErrorResponse>

/** Standard success response */
export const SuccessResponse = z.object({
  success: z.boolean(),
})
export type SuccessResponse = z.infer<typeof SuccessResponse>

/** Success with path response (for file operations) */
export const SuccessWithPathResponse = z.object({
  success: z.boolean(),
  path: z.string(),
})
export type SuccessWithPathResponse = z.infer<typeof SuccessWithPathResponse>

/** API info response */
export const ApiInfoResponse = z.object({
  message: z.string(),
  version: z.string(),
  docs: z.string(),
})
export type ApiInfoResponse = z.infer<typeof ApiInfoResponse>

/** Health check response */
export const HealthResponse = z.object({
  status: z.literal("ok"),
  timestamp: z.string(),
})
export type HealthResponse = z.infer<typeof HealthResponse>

// ============================================================================
// Pagination DTOs
// ============================================================================

/** Pagination query parameters */
export const PaginationQuery = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
})
export type PaginationQuery = z.infer<typeof PaginationQuery>

/** Paginated response wrapper */
export const PaginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  })
