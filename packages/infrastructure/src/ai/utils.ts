/**
 * AI Utilities
 *
 * Helper functions for AI adapters.
 */

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
