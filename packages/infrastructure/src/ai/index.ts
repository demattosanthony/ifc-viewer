/**
 * AI Infrastructure
 *
 * AI provider implementations for the IFC Viewer platform.
 */

// Anthropic
export {
  type AnthropicProviderConfig,
  createAnthropicProvider,
  provideViewerResult,
} from "./anthropic"
// Factory
export {
  type AIConfig,
  type AIProviderType,
  createAIProvider,
  createAIProviderFromEnv,
} from "./factory"
// Prompts
export {
  BIM_IDE_SYSTEM_PROMPT,
  type BuildSystemPromptOptions,
  buildSystemPrompt,
} from "./prompts"
// Tools
export { createFileTools } from "./tools/file-tools"
export { createShellTools } from "./tools/shell-tools"

// Utilities
export { formatUsageStats, getErrorMessage } from "./utils"
export { formatSkillsForPrompt } from "./utils/skill-formatter.ts"
