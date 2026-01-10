/**
 * Model DTOs
 *
 * Request/response schemas for model operations.
 */

import { ModelDisciplineSchema, ModelSchema } from "@ifc-viewer/core"
import { z } from "zod"

// ============================================================================
// Request DTOs
// ============================================================================

/** Upload model request (metadata, file comes separately) */
export const UploadModelRequest = z.object({
  name: z.string().min(1).max(255),
  discipline: ModelDisciplineSchema.optional(),
})
export type UploadModelRequest = z.infer<typeof UploadModelRequest>

/** Update model request */
export const UpdateModelRequest = z.object({
  name: z.string().min(1).max(255).optional(),
  discipline: ModelDisciplineSchema.optional(),
})
export type UpdateModelRequest = z.infer<typeof UpdateModelRequest>

/** Model ID parameter */
export const ModelIdParam = z.object({
  modelId: z.string(),
})
export type ModelIdParam = z.infer<typeof ModelIdParam>

/** Project ID + Model ID parameters */
export const ProjectModelParams = z.object({
  id: z.string(), // project ID
  modelId: z.string(),
})
export type ProjectModelParams = z.infer<typeof ProjectModelParams>

// ============================================================================
// Response DTOs
// ============================================================================

/** Model response - matches domain entity */
export const ModelResponse = ModelSchema
export type ModelResponse = z.infer<typeof ModelResponse>

/** List models response */
export const ModelListResponse = z.array(ModelResponse)
export type ModelListResponse = z.infer<typeof ModelListResponse>

/** Upload model response */
export const UploadModelResponse = ModelSchema
export type UploadModelResponse = z.infer<typeof UploadModelResponse>
