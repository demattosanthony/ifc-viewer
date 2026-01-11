/**
 * AI Utilities
 *
 * Helper functions for AI adapters.
 */

import type {
  AIMessage,
  AIMessageTextPart,
  AIMessageToolCallPart,
  AIMessageToolResultPart,
} from "@ifc-viewer/core"
import type { JSONValue, ModelMessage, ToolResultPart } from "ai"

/** Extract the output type that ToolResultPart expects */
type ToolResultOutput = ToolResultPart["output"]

/**
 * Convert a domain tool output to the SDK's ToolResultOutput format.
 * The SDK expects a discriminated union with a `type` field.
 */
function toToolResultOutput(value: unknown): ToolResultOutput {
  if (typeof value === "string") {
    return { type: "text", value }
  }
  // For objects, arrays, numbers, booleans - use JSON format
  return { type: "json", value: value as JSONValue }
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
 * Uses type guards for proper type narrowing without casts.
 */
function toModelMessage(message: AIMessage): ModelMessage | undefined {
  const { role, content } = message

  if (role === "system") {
    return {
      role: "system",
      content: typeof content === "string" ? content : "",
    }
  }

  if (role === "user") {
    if (typeof content === "string") {
      return { role: "user", content }
    }
    const textParts = content
      .filter((part): part is AIMessageTextPart => part.type === "text")
      .map((part) => ({ type: "text" as const, text: part.text }))
    return { role: "user", content: textParts }
  }

  if (role === "assistant") {
    if (typeof content === "string") {
      return { role: "assistant", content }
    }
    const parts = content
      .filter(
        (part): part is AIMessageTextPart | AIMessageToolCallPart =>
          part.type === "text" || part.type === "tool-call"
      )
      .map((part) =>
        part.type === "text"
          ? { type: "text" as const, text: part.text }
          : {
              type: "tool-call" as const,
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
            }
      )
    return { role: "assistant", content: parts }
  }

  if (role === "tool") {
    if (typeof content === "string") {
      return undefined
    }
    const resultParts = content
      .filter((part): part is AIMessageToolResultPart => part.type === "tool-result")
      .map((part) => ({
        type: "tool-result" as const,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        output: toToolResultOutput(part.output),
      }))
    return { role: "tool", content: resultParts }
  }

  return undefined
}

export function toModelMessages(messages: AIMessage[]): ModelMessage[] {
  return messages.map(toModelMessage).filter((m): m is ModelMessage => m !== undefined)
}
