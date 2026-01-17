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

/** Streaming states for reasoning */
export type ReasoningStreamingState = "streaming" | "done"

/** Text part: API type + stepIndex */
export type UITextPart = ApiTextPart & { stepIndex: number }

/** Tool part: API type with state instead of status + stepIndex */
export type UIToolPart = Omit<ApiToolPart, "status"> & {
  state: ToolStreamingState
  stepIndex: number
}

/** Reasoning part: for displaying AI thinking/reasoning traces */
export type UIReasoningPart = {
  type: "reasoning"
  id: string
  text: string
  state: ReasoningStreamingState
  stepIndex: number
}

export type UIMessagePart = UITextPart | UIToolPart | UIReasoningPart

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

// Reasoning part from API (may or may not exist in SDK types yet)
interface ApiReasoningPart {
  type: "reasoning"
  id: string
  text: string
}

function isApiReasoningPart(p: ApiPart | ApiReasoningPart): p is ApiReasoningPart {
  return p.type === "reasoning"
}

/** Convert API messages to UI format */
// ============================================================================
// Tool View Types
// ============================================================================

export interface ToolViewProps {
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  isStreaming: boolean
  isComplete?: boolean
  error?: string
}

/** Tool name aliases - all variations that map to the same tool type */
export const TOOL_NAMES = {
  writeFile: ["write_file", "writeFile"],
  readFile: ["read_file", "readFile"],
  executeCommand: ["executeCommand", "shell_execute"],
  executePython: ["executePython"],
  executeViewer: ["executeViewer"],
} as const

export type ToolType = keyof typeof TOOL_NAMES

// ============================================================================
// Converter (API → UI)
// ============================================================================

export function toStreamingMessages(messages: ApiMessage[]): StreamingMessage[] {
  return messages.map((m) => {
    // Cast parts to allow reasoning type (SDK may not have it yet)
    const apiParts = m.parts as (ApiPart | ApiReasoningPart)[]

    const parts: UIMessagePart[] = apiParts.map((p) => {
      if (p.type === "text") {
        return { ...p, stepIndex: 0 }
      }

      // Handle reasoning parts (may not be in SDK types yet)
      if (isApiReasoningPart(p)) {
        return {
          type: "reasoning" as const,
          id: p.id,
          text: p.text,
          state: "done" as const,
          stepIndex: 0,
        }
      }

      const { status, ...rest } = p
      const state = status === "success" ? "completed" : "error"
      const error = status === "aborted" ? (rest.error ?? "Cancelled") : rest.error
      return {
        ...rest,
        state,
        stepIndex: 0,
        ...(error ? { error } : {}),
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
