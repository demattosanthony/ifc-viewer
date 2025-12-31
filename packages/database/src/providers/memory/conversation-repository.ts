import type {
  Conversation,
  ConversationMessage,
  ConversationStatus,
  CreateConversationInput,
  AddMessageInput,
  ConversationRepository,
} from "@ifc-viewer/core";

/**
 * In-memory implementation of ConversationRepository
 * Suitable for development and single-instance deployments
 */
export class MemoryConversationRepository implements ConversationRepository {
  private conversations = new Map<string, Conversation>();
  private sessionIndex = new Map<string, string>(); // sessionId -> conversationId

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  async create(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date();

    const conversation: Conversation = {
      id: this.generateId("conv"),
      sessionId: input.sessionId,
      messages: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    this.conversations.set(conversation.id, conversation);
    this.sessionIndex.set(input.sessionId, conversation.id);

    return conversation;
  }

  async findById(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) ?? null;
  }

  async findBySessionId(sessionId: string): Promise<Conversation | null> {
    const conversationId = this.sessionIndex.get(sessionId);
    if (!conversationId) {
      return null;
    }
    return this.conversations.get(conversationId) ?? null;
  }

  async findAllBySessionId(sessionId: string): Promise<Conversation[]> {
    // In this simple implementation, we only track one conversation per session
    // For multiple conversations, we'd need a different index structure
    const conversation = await this.findBySessionId(sessionId);
    return conversation ? [conversation] : [];
  }

  async addMessage(
    conversationId: string,
    input: AddMessageInput
  ): Promise<ConversationMessage> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const message: ConversationMessage = {
      id: this.generateId("msg"),
      role: input.role,
      content: input.content,
      createdAt: new Date(),
    };

    conversation.messages.push(message);
    conversation.updatedAt = new Date();

    return message;
  }

  async updateStatus(id: string, status: ConversationStatus): Promise<void> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      return;
    }

    conversation.status = status;
    conversation.updatedAt = new Date();
  }

  async delete(id: string): Promise<void> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      return;
    }

    // Remove from session index
    this.sessionIndex.delete(conversation.sessionId);
    this.conversations.delete(id);
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    const conversationId = this.sessionIndex.get(sessionId);
    if (conversationId) {
      this.conversations.delete(conversationId);
      this.sessionIndex.delete(sessionId);
    }
  }

  async exists(id: string): Promise<boolean> {
    return this.conversations.has(id);
  }

  /**
   * Dispose all conversations
   */
  async disposeAll(): Promise<void> {
    this.conversations.clear();
    this.sessionIndex.clear();
  }
}
