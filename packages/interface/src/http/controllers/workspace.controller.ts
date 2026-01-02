/**
 * Workspace Controller
 *
 * Framework-agnostic HTTP controller for workspace operations.
 */

import {
  type Context,
  type Workspace,
  createWorkspaceWithFiles,
  isDomainError,
} from "@ifc-viewer/core"
import type { CreateWorkspaceRequest } from "../../dto"
import { type HttpResult, ok, notFound, err } from "../types"

export class WorkspaceController {
  constructor(private ctx: Context) {}

  /**
   * Create a new workspace
   */
  async create(input: CreateWorkspaceRequest): Promise<HttpResult<Workspace>> {
    try {
      const workspace = await createWorkspaceWithFiles(this.ctx, input)
      return ok(workspace)
    } catch (error) {
      if (isDomainError(error)) {
        return err(error.message, error.statusCode)
      }
      throw error
    }
  }

  /**
   * List all workspaces
   */
  async list(): Promise<HttpResult<Workspace[]>> {
    const workspaces = await this.ctx.db.workspaces.findAll()
    return ok(workspaces)
  }

  /**
   * List active workspaces
   */
  async listActive(): Promise<HttpResult<Workspace[]>> {
    const workspaces = await this.ctx.db.workspaces.findActive()
    return ok(workspaces)
  }

  /**
   * Get a workspace by ID
   */
  async getById(id: string): Promise<HttpResult<Workspace>> {
    const workspace = await this.ctx.db.workspaces.findById(id)
    if (!workspace) {
      return notFound(`Workspace ${id} not found`)
    }
    return ok(workspace)
  }

  /**
   * Touch a workspace (update last accessed time)
   */
  async touch(id: string): Promise<HttpResult<Workspace>> {
    const existing = await this.ctx.db.workspaces.findById(id)
    if (!existing) {
      return notFound(`Workspace ${id} not found`)
    }
    const updated = await this.ctx.db.workspaces.touch(id)
    return ok(updated)
  }

  /**
   * Stop a workspace
   */
  async stop(id: string): Promise<HttpResult<Workspace>> {
    const existing = await this.ctx.db.workspaces.findById(id)
    if (!existing) {
      return notFound(`Workspace ${id} not found`)
    }
    const updated = await this.ctx.db.workspaces.update(id, { status: "stopped" })
    return ok(updated)
  }

  /**
   * Delete a workspace
   */
  async delete(id: string): Promise<HttpResult<{ success: true }>> {
    const existing = await this.ctx.db.workspaces.findById(id)
    if (!existing) {
      return notFound(`Workspace ${id} not found`)
    }
    await this.ctx.db.workspaces.delete(id)
    return ok({ success: true })
  }
}
