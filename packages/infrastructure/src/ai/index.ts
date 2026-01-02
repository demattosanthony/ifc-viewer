/**
 * AI Infrastructure
 *
 * AI provider implementations for the IFC Viewer platform.
 */

// Factory
export {
  createAIProvider,
  createAIProviderFromEnv,
  type AIConfig,
  type AIProviderType,
} from "./factory"

// Anthropic
export {
  createAnthropicProvider,
  type AnthropicProviderConfig,
} from "./anthropic"

// Tools
export { createFileTools } from "./tools/file-tools"
export { createShellTools } from "./tools/shell-tools"

// Prompts
export { BIM_IDE_SYSTEM_PROMPT } from "./prompts/system-prompt"

// Utilities
export { getErrorMessage, formatUsageStats } from "./utils"
