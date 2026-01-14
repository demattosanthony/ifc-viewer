/**
 * Model Controller
 *
 * Framework-agnostic HTTP controller for model operations.
 */

import {
  type Context,
  deleteModel,
  getModelFragmentData,
  getModelWithData,
  isDomainError,
  listProjectModels,
  type Model,
  updateModel,
  uploadModel,
} from "@ifc-viewer/core"
import { createLogger } from "@ifc-viewer/logger"
import type { UpdateModelRequest, UploadModelRequest } from "../../dto"
import { err, type HttpResult, notFound, ok, serverError } from "../types"

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
   * Get model file data (for viewer to load IFC)
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
   * Get model fragment data (pre-converted for fast loading)
   */
  async getModelFragment(
    projectId: string,
    modelId: string
  ): Promise<HttpResult<{ data: Uint8Array; contentType: string }>> {
    const result = await getModelFragmentData(this.ctx, modelId)
    if (!result) {
      return notFound(`Fragment for model ${modelId} not found`)
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
      // Convert IFC to fragments
      let fragmentData: Uint8Array | undefined
      let fragmentPath: string | undefined
      let fragmentVersion: string | undefined

      try {
        fragmentData = await this.ctx.ifcProcessor.convert(data)
        fragmentPath = this.ctx.ifcProcessor.getFragmentPath(`models/${fileName}`)
        fragmentVersion = this.ctx.ifcProcessor.version
        log.debug("Fragment conversion succeeded", {
          projectId,
          fileName,
          fragmentSize: fragmentData.byteLength,
        })
      } catch (conversionError) {
        // Log but don't fail - client can still convert on-the-fly
        log.warn("Fragment conversion failed, client will convert on-the-fly", {
          projectId,
          fileName,
          error: conversionError,
        })
      }

      const model = await uploadModel(this.ctx, {
        projectId,
        name: metadata?.name ?? fileName.replace(/\.ifc$/i, ""),
        discipline: metadata?.discipline,
        fileName,
        data,
        fragmentData,
        fragmentPath,
        fragmentVersion,
      })

      log.info("Model uploaded", {
        projectId,
        modelId: model.id,
        name: model.name,
        size: model.fileSize,
        hasFragment: !!model.fragmentPath,
      })

      // Sync IFC file to compute if running
      await this.ctx.syncFileToCompute(projectId, model.filePath, "write")

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
  async delete(projectId: string, modelId: string): Promise<HttpResult<{ success: true }>> {
    try {
      // Verify model exists and belongs to project
      const existing = await this.ctx.db.models.findById(modelId)
      if (!existing) {
        return notFound(`Model ${modelId} not found`)
      }
      if (existing.projectId !== projectId) {
        return notFound(`Model ${modelId} not found in project ${projectId}`)
      }

      // Store file path before deletion for compute sync
      const filePath = existing.filePath

      await deleteModel(this.ctx, modelId)

      log.info("Model deleted", { projectId, modelId })

      // Sync delete to compute if running
      await this.ctx.syncFileToCompute(projectId, filePath, "delete")

      return ok({ success: true })
    } catch (error) {
      if (isDomainError(error)) {
        return err(error.message, error.statusCode)
      }
      throw error
    }
  }
}
