/**
 * AI Utilities
 *
 * Helper functions for AI adapters.
 */

import type { AIMessage } from "@ifc-viewer/core"
import type {
  AssistantModelMessage,
  ModelMessage,
  SystemModelMessage,
  ToolCallPart,
  ToolModelMessage,
  ToolResultPart,
  UserModelMessage,
} from "ai"

/** Extract the output type that ToolResultPart expects */
type ToolResultOutput = ToolResultPart["output"]

/** Assert that a value is a valid tool result output */
function asToolResultOutput(value: unknown): ToolResultOutput {
  // The SDK accepts string, number, boolean, objects, and arrays
  // At the adapter boundary, we trust that tool outputs are SDK-compatible
  return value as ToolResultOutput
}

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error"
}

/**
 * Comprehensive regex pattern for ANSI escape codes.
 * Matches:
 * - CSI sequences: \x1b[...X (colors, cursor, etc.)
 * - OSC sequences: \x1b]...BEL
 * - Simple escapes: \x1b followed by a single character
 * - Bracket paste mode: \x1b[?2004h/l
 */
const ANSI_PATTERN = new RegExp(
  [
    // CSI sequences (most common): ESC [ ... final_byte
    "\\x1b\\[[0-9;?]*[A-Za-z]",
    // OSC sequences: ESC ] ... (BEL or ST)
    "\\x1b\\][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)?",
    // Simple escape sequences: ESC followed by single char
    "\\x1b[NOPcn]",
    // Other common sequences
    "\\x1b\\(B", // Character set selection
  ].join("|"),
  "g"
)

/**
 * Control characters to strip (except newline and tab).
 * - \r (carriage return) - causes display issues
 * - \x00-\x08, \x0b-\x0c, \x0e-\x1f (other control chars)
 */
const CONTROL_CHARS_PATTERN = /[\x00-\x08\x0b\x0c\x0e-\x1f\r]/g

/**
 * Strip ANSI escape codes and control characters from terminal output.
 *
 * @param str - Raw terminal output string
 * @returns Cleaned string suitable for display
 */
export function stripAnsi(str: string): string {
  return str.replace(ANSI_PATTERN, "").replace(CONTROL_CHARS_PATTERN, "")
}

/**
 * Format AI SDK usage stats into our UsageStats type
 */
export function formatUsageStats(
  usage:
    | {
        inputTokens?: number
        outputTokens?: number
      }
    | undefined
) {
  const promptTokens = usage?.inputTokens ?? 0
  const completionTokens = usage?.outputTokens ?? 0
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  }
}

/**
 * Convert domain AIMessage to SDK ModelMessage format.
 * This is the adapter boundary where domain types meet SDK types.
 */
function toModelMessage(message: AIMessage): ModelMessage {
  switch (message.role) {
    case "system": {
      const content = typeof message.content === "string" ? message.content : ""
      return { role: "system", content } satisfies SystemModelMessage
    }
    case "user": {
      if (typeof message.content === "string") {
        return { role: "user", content: message.content } satisfies UserModelMessage
      }
      // User messages with parts
      const parts = message.content.map((part) => {
        if (part.type === "text") {
          return { type: "text" as const, text: part.text }
        }
        throw new Error(`Unexpected part type in user message: ${part.type}`)
      })
      return { role: "user", content: parts } satisfies UserModelMessage
    }
    case "assistant": {
      if (typeof message.content === "string") {
        return { role: "assistant", content: message.content } satisfies AssistantModelMessage
      }
      // Assistant messages with tool calls
      const parts = message.content.map((part) => {
        if (part.type === "text") {
          return { type: "text" as const, text: part.text }
        }
        if (part.type === "tool-call") {
          return {
            type: "tool-call" as const,
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
          } satisfies ToolCallPart
        }
        throw new Error(`Unexpected part type in assistant message: ${part.type}`)
      })
      return { role: "assistant", content: parts } satisfies AssistantModelMessage
    }
    case "tool": {
      if (!Array.isArray(message.content)) {
        throw new Error("Tool message content must be an array")
      }
      const parts = message.content.map((part) => {
        if (part.type === "tool-result") {
          return {
            type: "tool-result" as const,
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            output: asToolResultOutput(part.output),
          } satisfies ToolResultPart
        }
        throw new Error(`Unexpected part type in tool message: ${part.type}`)
      })
      return { role: "tool", content: parts } satisfies ToolModelMessage
    }
  }
}

export function toModelMessages(messages: AIMessage[]): ModelMessage[] {
  return messages.map(toModelMessage)
}
