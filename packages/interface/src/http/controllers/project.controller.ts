/**
 * Project Controller
 *
 * Framework-agnostic HTTP controller for project operations.
 */

import {
  type Context,
  createProjectWithStorage,
  isDomainError,
  type Project,
} from "@ifc-viewer/core"
import type { CreateProjectRequest, UpdateProjectRequest } from "../../dto"
import { err, type HttpResult, notFound, ok } from "../types"

export class ProjectController {
  constructor(private ctx: Context) {}

  /**
   * Create a new project
   */
  async create(input: CreateProjectRequest): Promise<HttpResult<Project>> {
    try {
      const project = await createProjectWithStorage(this.ctx, input)
      return ok(project)
    } catch (error) {
      if (isDomainError(error)) {
        return err(error.message, error.statusCode)
      }
      throw error
    }
  }

  /**
   * List all projects
   */
  async list(): Promise<HttpResult<Project[]>> {
    const projects = await this.ctx.db.projects.findAll()
    return ok(projects)
  }

  /**
   * Get a project by ID
   */
  async getById(id: string): Promise<HttpResult<Project>> {
    const project = await this.ctx.db.projects.findById(id)
    if (!project) {
      return notFound(`Project ${id} not found`)
    }
    return ok(project)
  }

  /**
   * Update a project
   */
  async update(id: string, input: UpdateProjectRequest): Promise<HttpResult<Project>> {
    const existing = await this.ctx.db.projects.findById(id)
    if (!existing) {
      return notFound(`Project ${id} not found`)
    }
    const updated = await this.ctx.db.projects.update(id, input)
    return ok(updated)
  }

  /**
   * Delete a project
   */
  async delete(id: string): Promise<HttpResult<{ success: true }>> {
    const existing = await this.ctx.db.projects.findById(id)
    if (!existing) {
      return notFound(`Project ${id} not found`)
    }
    await this.ctx.db.projects.delete(id)
    return ok({ success: true })
  }
}
