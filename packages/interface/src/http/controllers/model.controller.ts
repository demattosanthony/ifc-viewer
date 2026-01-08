/**
 * Model Controller
 *
 * Framework-agnostic HTTP controller for model operations.
 */

import {
  type Context,
  type Model,
  uploadModel,
  listProjectModels,
  updateModel,
  deleteModel,
  getModelWithData,
  isDomainError,
} from "@ifc-viewer/core"
import { createLogger } from "@ifc-viewer/logger"
import type { UploadModelRequest, UpdateModelRequest } from "../../dto"
import { type HttpResult, ok, notFound, err, serverError } from "../types"

const log = createLogger("model-controller")

export class ModelController {
  constructor(private ctx: Context) {}

  /**
   * List all models for a project
   */
  async list(projectId: string): Promise<HttpResult<Model[]>> {
    // Verify project exists
    const project = await this.ctx.db.projects.findById(projectId)
    if (!project) {
      return notFound(`Project ${projectId} not found`)
    }

    const models = await listProjectModels(this.ctx, projectId)
    return ok(models)
  }

  /**
   * Get a model by ID
   */
  async getById(projectId: string, modelId: string): Promise<HttpResult<Model>> {
    const model = await this.ctx.db.models.findById(modelId)
    if (!model) {
      return notFound(`Model ${modelId} not found`)
    }

    // Verify model belongs to project
    if (model.projectId !== projectId) {
      return notFound(`Model ${modelId} not found in project ${projectId}`)
    }

    return ok(model)
  }

  /**
   * Get model file data (for viewer to load)
   */
  async getModelFile(
    projectId: string,
    modelId: string
  ): Promise<HttpResult<{ data: Uint8Array; contentType: string }>> {
    const result = await getModelWithData(this.ctx, modelId)
    if (!result) {
      return notFound(`Model ${modelId} not found`)
    }

    // Verify model belongs to project
    if (result.model.projectId !== projectId) {
      return notFound(`Model ${modelId} not found in project ${projectId}`)
    }

    return ok({
      data: result.data,
      contentType: "application/octet-stream",
    })
  }

  /**
   * Upload a new model
   */
  async upload(
    projectId: string,
    fileName: string,
    data: Uint8Array,
    metadata?: UploadModelRequest
  ): Promise<HttpResult<Model>> {
    try {
      const model = await uploadModel(this.ctx, {
        projectId,
        name: metadata?.name ?? fileName.replace(/\.ifc$/i, ""),
        discipline: metadata?.discipline,
        fileName,
        data,
      })

      log.info("Model uploaded", {
        projectId,
        modelId: model.id,
        name: model.name,
        size: model.fileSize,
      })

      return ok(model)
    } catch (error) {
      if (isDomainError(error)) {
        return err(error.message, error.statusCode)
      }
      log.error("Failed to upload model", { projectId, fileName, error })
      return serverError("Failed to upload model")
    }
  }

  /**
   * Update model metadata
   */
  async update(
    projectId: string,
    modelId: string,
    input: UpdateModelRequest
  ): Promise<HttpResult<Model>> {
    try {
      // Verify model exists and belongs to project
      const existing = await this.ctx.db.models.findById(modelId)
      if (!existing) {
        return notFound(`Model ${modelId} not found`)
      }
      if (existing.projectId !== projectId) {
        return notFound(`Model ${modelId} not found in project ${projectId}`)
      }

      const updated = await updateModel(this.ctx, modelId, input)
      return ok(updated)
    } catch (error) {
      if (isDomainError(error)) {
        return err(error.message, error.statusCode)
      }
      throw error
    }
  }

  /**
   * Delete a model
   */
  async delete(
    projectId: string,
    modelId: string
  ): Promise<HttpResult<{ success: true }>> {
    try {
      // Verify model exists and belongs to project
      const existing = await this.ctx.db.models.findById(modelId)
      if (!existing) {
        return notFound(`Model ${modelId} not found`)
      }
      if (existing.projectId !== projectId) {
        return notFound(`Model ${modelId} not found in project ${projectId}`)
      }

      await deleteModel(this.ctx, modelId)

      log.info("Model deleted", { projectId, modelId })

      return ok({ success: true })
    } catch (error) {
      if (isDomainError(error)) {
        return err(error.message, error.statusCode)
      }
      throw error
    }
  }
}
