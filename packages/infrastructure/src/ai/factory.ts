/**
 * AI Provider Factory
 *
 * Creates AI providers from configuration.
 */

import type { AIProvider } from "@ifc-viewer/core"
import { createAnthropicProvider, type AnthropicProviderConfig } from "./anthropic"

/** Supported AI provider types */
export type AIProviderType = "anthropic" // Future: | "openai" | "google"

/** Configuration for creating an AI provider */
export type AIConfig =
  | ({ type: "anthropic" } & AnthropicProviderConfig)
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
 * Create an AI provider from environment variables
 *
 * Checks for:
 * - AI_PROVIDER: "anthropic" (default)
 * - AI_MODEL: Model name (optional)
 * - ANTHROPIC_API_KEY: API key for Anthropic
 */
export function createAIProviderFromEnv(): AIProvider {
  const providerType = (process.env.AI_PROVIDER ?? "anthropic") as AIProviderType
  const model = process.env.AI_MODEL

  switch (providerType) {
    case "anthropic":
      return createAnthropicProvider({
        model,
        apiKey: process.env.ANTHROPIC_API_KEY,
      })
    default:
      throw new Error(`Unknown AI provider type: ${providerType}`)
  }
}
