/**
 * Conversation Controller
 *
 * Framework-agnostic HTTP controller for conversation operations.
 *
 * Note: The chat streaming endpoint is kept in the routes layer
 * since it requires framework-specific SSE handling.
 */

import type { Context } from "@ifc-viewer/core"
import type {
  ConversationResponse,
  ConversationListResponse,
  ConversationWithMessagesResponse,
} from "../../dto"
import { type HttpResult, ok, notFound } from "../types"

export class ConversationController {
  constructor(private ctx: Context) {}

  /**
   * Create a new conversation for a project
   */
  async create(
    projectId: string,
    title?: string
  ): Promise<HttpResult<ConversationResponse>> {
    // Verify project exists
    const project = await this.ctx.db.projects.findById(projectId)
    if (!project) {
      return notFound(`Project ${projectId} not found`)
    }

    const conversation = await this.ctx.db.conversations.create({
      projectId,
      title,
    })
    return ok(conversation)
  }

  /**
   * Get a conversation by ID with its messages
   */
  async getById(
    conversationId: string
  ): Promise<HttpResult<ConversationWithMessagesResponse>> {
    const conversation = await this.ctx.db.conversations.findById(conversationId)
    if (!conversation) {
      return notFound("Conversation not found")
    }

    const messages = await this.ctx.db.messages.findByConversationId(
      conversation.id
    )

    return ok({ ...conversation, messages })
  }

  /**
   * List all conversations for a project
   */
  async listByProject(
    projectId: string
  ): Promise<HttpResult<ConversationListResponse>> {
    const conversations = await this.ctx.db.conversations.findByProjectId(
      projectId
    )
    return ok(conversations)
  }

  /**
   * Delete a specific conversation
   */
  async delete(conversationId: string): Promise<HttpResult<{ success: true }>> {
    await this.ctx.db.conversations.delete(conversationId)
    return ok({ success: true })
  }

  /**
   * Delete all conversations for a project
   */
  async clearProject(projectId: string): Promise<HttpResult<{ success: true }>> {
    await this.ctx.db.conversations.deleteByProjectId(projectId)
    return ok({ success: true })
  }
}

// Keep old name as alias for backward compatibility during migration
export { ConversationController as AgentController }
