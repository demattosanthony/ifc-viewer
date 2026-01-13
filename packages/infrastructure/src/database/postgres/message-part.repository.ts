import type { MessagePart, MessagePartRepository } from "@ifc-viewer/core"
import { generateId } from "@ifc-viewer/core"
import { asc, eq, inArray } from "drizzle-orm"

import type { DrizzleDB, DrizzleTransaction } from "./db"
import { messageParts } from "./schema"

type MessagePartRow = typeof messageParts.$inferSelect

function rowToMessagePart(row: MessagePartRow): MessagePart {
  if (row.type === "text") {
    return {
      type: "text",
      text: row.text ?? "",
    }
  }
  if (row.type === "reasoning") {
    return {
      type: "reasoning",
      id: row.reasoningId ?? "",
      text: row.text ?? "",
    }
  }
  return {
    type: "tool-use",
    id: row.toolCallId ?? "",
    name: row.toolName ?? "",
    input: (row.toolInput as Record<string, unknown>) ?? {},
    output: row.toolOutput,
    status: (row.toolStatus as "success" | "error" | "aborted") ?? "success",
    error: row.toolError ?? undefined,
  }
}

export function createMessagePartRepository(
  db: DrizzleDB | DrizzleTransaction
): MessagePartRepository {
  return {
    async createMany(messageId: string, parts: MessagePart[]): Promise<void> {
      if (parts.length === 0) return

      const now = new Date()
      const rows = parts.map((part, position) => {
        const base = {
          id: generateId(),
          messageId,
          position,
          type: part.type as "text" | "tool-use" | "reasoning",
          createdAt: now,
        }

        if (part.type === "text") {
          return { ...base, text: part.text }
        }

        if (part.type === "reasoning") {
          return { ...base, reasoningId: part.id, text: part.text }
        }

        return {
          ...base,
          toolCallId: part.id,
          toolName: part.name,
          toolInput: part.input,
          toolOutput: part.output,
          toolStatus: part.status as "success" | "error" | "aborted",
          toolError: part.error,
        }
      })

      await db.insert(messageParts).values(rows)
    },

    async findByMessageId(messageId: string): Promise<MessagePart[]> {
      const rows = await db
        .select()
        .from(messageParts)
        .where(eq(messageParts.messageId, messageId))
        .orderBy(asc(messageParts.position))

      return rows.map(rowToMessagePart)
    },

    async findByMessageIds(messageIds: string[]): Promise<Map<string, MessagePart[]>> {
      if (messageIds.length === 0) return new Map()

      const rows = await db
        .select()
        .from(messageParts)
        .where(inArray(messageParts.messageId, messageIds))
        .orderBy(asc(messageParts.messageId), asc(messageParts.position))

      const result = new Map<string, MessagePart[]>()
      for (const row of rows) {
        const parts = result.get(row.messageId) ?? []
        parts.push(rowToMessagePart(row))
        result.set(row.messageId, parts)
      }

      return result
    },
  }
}
