import type { Message } from "../entities/message";
import type { CreateMessageInput } from "./types";

/**
 * Repository interface for Message entity persistence
 */
export interface MessageRepository {
  create(input: CreateMessageInput): Promise<Message>;
  findByConversationId(conversationId: string): Promise<Message[]>;
}
