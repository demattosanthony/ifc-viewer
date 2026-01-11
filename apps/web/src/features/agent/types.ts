/**
 * Agent UI Types
 *
 * Extends SDK types with streaming-specific state.
 */

import type { GetConversationResponse } from "@ifc-viewer/sdk"

// SDK types
type ApiMessage = GetConversationResponse["messages"][number]
type ApiPart = ApiMessage["parts"][number]
type ApiTextPart = Extract<ApiPart, { type: "text" }>
type ApiToolPart = Extract<ApiPart, { type: "tool-use" }>

// ============================================================================
// UI Part Types (SDK + stepIndex + streaming state)
// ============================================================================

/** Streaming states for tools (superset of API's status) */
export type ToolStreamingState =
  | "pending"
  | "streaming"
  | "running"
  | "completed"
  | "error"
  | "needs-approval"

/** Text part: API type + stepIndex */
export type UITextPart = ApiTextPart & { stepIndex: number }

/** Tool part: API type with state instead of status + stepIndex */
export type UIToolPart = Omit<ApiToolPart, "status"> & {
  state: ToolStreamingState
  stepIndex: number
}

export type UIMessagePart = UITextPart | UIToolPart

/** Message with UI streaming state */
export interface StreamingMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  parts?: UIMessagePart[]
  createdAt: Date
}

// ============================================================================
// Converter (API → UI)
// ============================================================================

/** Convert API messages to UI format */
export function toStreamingMessages(messages: ApiMessage[]): StreamingMessage[] {
  return messages.map((m) => {
    const parts: UIMessagePart[] = m.parts.map((p) => {
      if (p.type === "text") {
        return { ...p, stepIndex: 0 }
      }
      const { status, ...rest } = p
      return {
        ...rest,
        state: status === "success" ? "completed" : status === "error" ? "error" : "pending",
        stepIndex: 0,
      } as UIToolPart
    })

    const content = m.parts
      .filter((p): p is ApiTextPart => p.type === "text")
      .map((p) => p.text)
      .join("")

    return {
      id: m.id,
      role: m.role,
      content,
      parts,
      createdAt: new Date(m.createdAt),
    }
  })
}
