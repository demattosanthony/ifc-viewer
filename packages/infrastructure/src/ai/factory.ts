/**
 * AI Provider Factory
 *
 * Creates AI providers from configuration.
 */

import type { AIProvider, AIThinkingConfig } from "@ifc-viewer/core"
import { type AnthropicProviderConfig, createAnthropicProvider } from "./anthropic.ts"

/** Supported AI provider types */
export type AIProviderType = "anthropic" // Future: | "openai" | "google"

/** Configuration for creating an AI provider */
export type AIConfig = { type: "anthropic" } & AnthropicProviderConfig
// Future:
// | ({ type: "openai" } & OpenAIProviderConfig)
// | ({ type: "google" } & GoogleProviderConfig)

/**
 * Create an AI provider from configuration
 */
export function createAIProvider(config: AIConfig): AIProvider {
  switch (config.type) {
    case "anthropic":
      return createAnthropicProvider(config)
    default:
      throw new Error(`Unknown AI provider type: ${(config as { type: string }).type}`)
  }
}

/**
 * Parse thinking configuration from environment variables
 *
 * - AI_THINKING_ENABLED: "true" to enable extended thinking (default: false)
 * - AI_THINKING_BUDGET_TOKENS: Token budget for thinking (default: 10000)
 */
function parseThinkingConfigFromEnv(): AIThinkingConfig | undefined {
  const enabled = process.env.AI_THINKING_ENABLED === "true"
  if (!enabled) return undefined

  const budgetTokens = process.env.AI_THINKING_BUDGET_TOKENS
    ? Number.parseInt(process.env.AI_THINKING_BUDGET_TOKENS, 10)
    : 10000

  return {
    type: "enabled",
    budgetTokens,
  }
}

/**
 * Create an AI provider from environment variables
 *
 * Checks for:
 * - AI_PROVIDER: "anthropic" (default)
 * - AI_MODEL: Model name (optional)
 * - ANTHROPIC_API_KEY: API key for Anthropic
 * - AI_THINKING_ENABLED: "true" to enable extended thinking
 * - AI_THINKING_BUDGET_TOKENS: Token budget for thinking (default: 10000)
 */
export function createAIProviderFromEnv(): AIProvider {
  const providerType = (process.env.AI_PROVIDER ?? "anthropic") as AIProviderType
  const model = process.env.AI_MODEL
  const thinking = parseThinkingConfigFromEnv()

  switch (providerType) {
    case "anthropic":
      return createAnthropicProvider({
        model,
        apiKey: process.env.ANTHROPIC_API_KEY,
        thinking,
      })
    default:
      throw new Error(`Unknown AI provider type: ${providerType}`)
  }
}
