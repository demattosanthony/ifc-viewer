/**
 * Model Service
 *
 * Application services for model operations that require
 * coordination between database and storage.
 *
 * Models (IFC files) are stored in the models/ directory within a project:
 *   projects/{projectId}/models/{filename}.ifc
 */

import type { Context } from "../context"
import type { Model, ModelDiscipline } from "../domain"
import { getModelStorageKey, inferDiscipline } from "../domain"
import { NotFoundError } from "../domain/errors"

/** Models directory within a project */
const MODELS_DIR = "models"

export type UploadModelInput = {
  projectId: string
  name: string
  discipline?: ModelDiscipline
  fileName: string
  data: Uint8Array
  /** Pre-converted fragment data (optional) */
  fragmentData?: Uint8Array
  /** Fragment file path relative to project */
  fragmentPath?: string
  /** Fragment format version */
  fragmentVersion?: string
}

export type UpdateModelInput = {
  name?: string
  discipline?: ModelDiscipline
}

/**
 * Upload a model to a project.
 *
 * - Validates the project exists
 * - Stores IFC file in models/ directory
 * - Stores fragment file if provided
 * - Creates or updates model metadata in database
 *
 * If a model with the same file path already exists, the existing record
 * is updated (preserving model ID) instead of creating a duplicate.
 */
export async function uploadModel(ctx: Context, input: UploadModelInput): Promise<Model> {
  // Verify project exists
  const project = await ctx.db.projects.findById(input.projectId)
  if (!project) throw new NotFoundError("Project", input.projectId)

  // Infer discipline from filename if not provided
  const discipline = input.discipline ?? inferDiscipline(input.fileName)

  // Models are stored in models/ directory
  const filePath = `${MODELS_DIR}/${input.fileName}`
  const storageKey = getModelStorageKey(input.projectId, filePath)

  // Check if a model with the same file path already exists
  const existingModel = await ctx.db.models.findByFilePath(input.projectId, filePath)

  // If model exists, delete old fragment file before storing new one
  if (existingModel?.fragmentPath) {
    const oldFragmentKey = getModelStorageKey(input.projectId, existingModel.fragmentPath)
    await ctx.storage.delete(oldFragmentKey)
  }

  // Store IFC file in project storage (overwrites if exists)
  await ctx.storage.put(storageKey, input.data, {
    contentType: "application/x-step",
  })

  // Store fragment file if provided
  let fragmentPath: string | null = null
  let fragmentSize: number | null = null
  let fragmentVersion: string | null = null

  if (input.fragmentData && input.fragmentPath) {
    fragmentPath = input.fragmentPath
    fragmentSize = input.fragmentData.byteLength
    fragmentVersion = input.fragmentVersion ?? null

    const fragmentStorageKey = getModelStorageKey(input.projectId, fragmentPath)
    await ctx.storage.put(fragmentStorageKey, input.fragmentData, {
      contentType: "application/octet-stream",
    })
  }

  // Update existing model or create new one
  if (existingModel) {
    // Update existing model record (preserves model ID)
    return ctx.db.models.update(existingModel.id, {
      name: input.name,
      discipline,
      fileSize: input.data.byteLength,
      fragmentPath,
      fragmentSize,
      fragmentVersion,
    })
  }

  // Create new model metadata in database
  const model = await ctx.db.models.create({
    projectId: input.projectId,
    name: input.name,
    discipline,
    filePath,
    fileSize: input.data.byteLength,
    fragmentPath,
    fragmentSize,
    fragmentVersion,
  })

  return model
}

/**
 * Get a model by ID with its file data.
 */
export async function getModelWithData(
  ctx: Context,
  modelId: string
): Promise<{ model: Model; data: Uint8Array } | null> {
  const model = await ctx.db.models.findById(modelId)
  if (!model) return null

  const storageKey = getModelStorageKey(model.projectId, model.filePath)
  const obj = await ctx.storage.get(storageKey)
  if (!obj) return null

  return { model, data: obj.data }
}

/**
 * Get a model's fragment data.
 */
export async function getModelFragmentData(
  ctx: Context,
  modelId: string
): Promise<{ model: Model; data: Uint8Array } | null> {
  const model = await ctx.db.models.findById(modelId)
  if (!model || !model.fragmentPath) return null

  const storageKey = getModelStorageKey(model.projectId, model.fragmentPath)
  const obj = await ctx.storage.get(storageKey)
  if (!obj) return null

  return { model, data: obj.data }
}

/**
 * List all models for a project.
 */
export async function listProjectModels(ctx: Context, projectId: string): Promise<Model[]> {
  return ctx.db.models.findByProjectId(projectId)
}

/**
 * Update model metadata.
 */
export async function updateModel(
  ctx: Context,
  modelId: string,
  input: UpdateModelInput
): Promise<Model> {
  const model = await ctx.db.models.findById(modelId)
  if (!model) throw new NotFoundError("Model", modelId)

  return ctx.db.models.update(modelId, input)
}

/**
 * Delete a model.
 *
 * - Removes model metadata from database
 * - Deletes IFC file from storage
 * - Deletes fragment file from storage if exists
 */
export async function deleteModel(ctx: Context, modelId: string): Promise<void> {
  const model = await ctx.db.models.findById(modelId)
  if (!model) throw new NotFoundError("Model", modelId)

  // Delete IFC file from storage
  const storageKey = getModelStorageKey(model.projectId, model.filePath)
  await ctx.storage.delete(storageKey)

  // Delete fragment file if exists
  if (model.fragmentPath) {
    const fragmentStorageKey = getModelStorageKey(model.projectId, model.fragmentPath)
    await ctx.storage.delete(fragmentStorageKey)
  }

  // Delete from database
  await ctx.db.models.delete(modelId)
}

/**
 * Delete all models for a project.
 */
export async function deleteProjectModels(ctx: Context, projectId: string): Promise<void> {
  const models = await ctx.db.models.findByProjectId(projectId)

  // Delete all model files from storage
  for (const model of models) {
    const storageKey = getModelStorageKey(model.projectId, model.filePath)
    await ctx.storage.delete(storageKey)

    // Delete fragment file if exists
    if (model.fragmentPath) {
      const fragmentStorageKey = getModelStorageKey(model.projectId, model.fragmentPath)
      await ctx.storage.delete(fragmentStorageKey)
    }
  }

  // Delete all model metadata from database
  await ctx.db.models.deleteByProjectId(projectId)
}
