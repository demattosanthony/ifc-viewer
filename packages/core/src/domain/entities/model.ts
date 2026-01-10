/**
 * Model Entity
 *
 * Represents an IFC model file within a project.
 * Stores metadata in the database, actual IFC file in storage.
 */

import { z } from "zod"
import { buildStorageKey } from "../../utils/storage.ts"

// ============================================================================
// Schema & Types
// ============================================================================

export const ModelDisciplineSchema = z.enum(["architecture", "structure", "mep", "site", "other"])

export const ModelSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  name: z.string(),
  discipline: ModelDisciplineSchema,
  /** Path to IFC file in storage (relative to project, always in models/) */
  filePath: z.string(),
  /** File size in bytes */
  fileSize: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type ModelDiscipline = z.infer<typeof ModelDisciplineSchema>
export type Model = z.infer<typeof ModelSchema>

/** Namespace for Model-related input types */
export namespace Model {
  export type CreateInput = {
    projectId: string
    name: string
    discipline?: ModelDiscipline
    filePath: string
    fileSize: number
  }

  export type UpdateInput = {
    name?: string
    discipline?: ModelDiscipline
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the storage key for a model's IFC file.
 * Models are stored at: projects/{projectId}/models/{filename}
 */
export function getModelStorageKey(projectId: string, filePath: string): string {
  return buildStorageKey(projectId, filePath)
}

/**
 * Infer discipline from filename if not provided.
 */
export function inferDiscipline(filename: string): ModelDiscipline {
  const lower = filename.toLowerCase()
  if (lower.includes("arch") || lower.includes("architecture")) return "architecture"
  if (lower.includes("struct") || lower.includes("structural")) return "structure"
  if (
    lower.includes("mep") ||
    lower.includes("mechanical") ||
    lower.includes("electrical") ||
    lower.includes("plumbing")
  )
    return "mep"
  if (lower.includes("site") || lower.includes("civil")) return "site"
  return "other"
}
