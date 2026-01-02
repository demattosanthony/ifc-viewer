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
