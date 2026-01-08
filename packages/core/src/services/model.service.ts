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
}

export type UpdateModelInput = {
  name?: string
  discipline?: ModelDiscipline
}

/**
 * Upload a new model to a project.
 *
 * - Validates the project exists
 * - Stores IFC file in models/ directory
 * - Creates model metadata in database
 */
export async function uploadModel(
  ctx: Context,
  input: UploadModelInput
): Promise<Model> {
  // Verify project exists
  const project = await ctx.db.projects.findById(input.projectId)
  if (!project) throw new NotFoundError("Project", input.projectId)

  // Infer discipline from filename if not provided
  const discipline = input.discipline ?? inferDiscipline(input.fileName)

  // Models are stored in models/ directory
  const filePath = `${MODELS_DIR}/${input.fileName}`
  const storageKey = getModelStorageKey(input.projectId, filePath)

  // Store IFC file in project storage
  await ctx.storage.put(storageKey, input.data, {
    contentType: "application/x-step",
  })

  // Create model metadata in database
  const model = await ctx.db.models.create({
    projectId: input.projectId,
    name: input.name,
    discipline,
    filePath,
    fileSize: input.data.byteLength,
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
 * List all models for a project.
 */
export async function listProjectModels(
  ctx: Context,
  projectId: string
): Promise<Model[]> {
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
 */
export async function deleteModel(
  ctx: Context,
  modelId: string
): Promise<void> {
  const model = await ctx.db.models.findById(modelId)
  if (!model) throw new NotFoundError("Model", modelId)

  // Delete from storage first
  const storageKey = getModelStorageKey(model.projectId, model.filePath)
  await ctx.storage.delete(storageKey)

  // Delete from database
  await ctx.db.models.delete(modelId)
}

/**
 * Delete all models for a project.
 */
export async function deleteProjectModels(
  ctx: Context,
  projectId: string
): Promise<void> {
  const models = await ctx.db.models.findByProjectId(projectId)

  // Delete all model files from storage
  for (const model of models) {
    const storageKey = getModelStorageKey(model.projectId, model.filePath)
    await ctx.storage.delete(storageKey)
  }

  // Delete all model metadata from database
  await ctx.db.models.deleteByProjectId(projectId)
}
