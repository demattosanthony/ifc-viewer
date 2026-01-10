/**
 * AI Infrastructure
 *
 * AI provider implementations for the IFC Viewer platform.
 */

// Anthropic
export {
  type AnthropicProviderConfig,
  createAnthropicProvider,
} from "./anthropic"
// Factory
export {
  type AIConfig,
  type AIProviderType,
  createAIProvider,
  createAIProviderFromEnv,
} from "./factory"
// Prompts
export { BIM_IDE_SYSTEM_PROMPT } from "./prompts/system-prompt"
// Tools
export { createFileTools } from "./tools/file-tools"
export { createShellTools } from "./tools/shell-tools"

// Utilities
export { formatUsageStats, getErrorMessage } from "./utils"
