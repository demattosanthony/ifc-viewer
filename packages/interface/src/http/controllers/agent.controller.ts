/**
 * Agent Controller
 *
 * Framework-agnostic HTTP controller for AI agent operations.
 *
 * Note: The chat streaming endpoint is kept in the routes layer
 * since it requires framework-specific SSE handling.
 */

import {
  type Context,
  getConversation,
  clearConversation,
} from "@ifc-viewer/core"
import type { ConversationWithMessagesResponse } from "../../dto"
import { type HttpResult, ok, notFound } from "../types"

export class AgentController {
  constructor(private ctx: Context) {}

  /**
   * Get conversation for a workspace
   */
  async getConversation(
    workspaceId: string
  ): Promise<HttpResult<ConversationWithMessagesResponse>> {
    const conversation = await getConversation(this.ctx, workspaceId)
    if (!conversation) {
      return notFound("No conversation found")
    }
    return ok(conversation)
  }

  /**
   * Clear conversation history
   */
  async clearHistory(workspaceId: string): Promise<HttpResult<{ success: true }>> {
    await clearConversation(this.ctx, workspaceId)
    return ok({ success: true })
  }
}
