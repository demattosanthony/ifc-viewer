/**
 * Anthropic AI Provider
 *
 * Implements AIProvider using Vercel AI SDK with Anthropic.
 * Supports extended thinking (reasoning) for models that support it.
 */

import { createAnthropic } from "@ai-sdk/anthropic"
import type {
  AIChatOptions,
  AIEvent,
  AIProvider,
  AIProviderConfig,
  AIThinkingConfig,
} from "@ifc-viewer/core"
import { ToolLoopAgent } from "ai"
import { BIM_IDE_SYSTEM_PROMPT } from "./prompts/system-prompt"
import { createFileTools } from "./tools/file-tools"
import { createPythonTools } from "./tools/python-tools"
import { createShellTools } from "./tools/shell-tools"
import { formatUsageStats, getErrorMessage, toModelMessages } from "./utils"

/** Anthropic-specific provider configuration */
export interface AnthropicProviderConfig extends AIProviderConfig {
  /** Anthropic API key (defaults to ANTHROPIC_API_KEY env var) */
  apiKey?: string
  /** System prompt (defaults to BIM_IDE_SYSTEM_PROMPT) */
  systemPrompt?: string
  /** Extended thinking configuration (enables reasoning traces) */
  thinking?: AIThinkingConfig
}

/**
 * Create an Anthropic AI provider
 */
export function createAnthropicProvider(config: AnthropicProviderConfig = {}): AIProvider {
  const anthropic = createAnthropic({
    apiKey: config.apiKey,
    headers: {
      "anthropic-beta": "fine-grained-tool-streaming-2025-05-14",
    },
  })

  const model = config.model ?? "claude-sonnet-4-5"
  const systemPrompt = config.systemPrompt ?? BIM_IDE_SYSTEM_PROMPT
  const thinking = config.thinking

  return {
    id: "anthropic",

    async *streamChat(options: AIChatOptions): AsyncGenerator<AIEvent> {
      // Queue for tool-emitted events (editor-open, terminal-focus, etc.)
      // These events are emitted by tools during execution and need to be
      // interleaved with the stream events
      const toolEventQueue: AIEvent[] = []

      // Tools use this to emit UI events
      const emitToolEvent = (event: AIEvent) => {
        toolEventQueue.push(event)
      }

      // Helper to yield all queued tool events
      function* yieldQueuedEvents(): Generator<AIEvent> {
        while (toolEventQueue.length > 0) {
          yield toolEventQueue.shift()!
        }
      }

      try {
        const tools = {
          ...createFileTools({
            computer: options.computer,
            changeTracker: options.changeTracker,
            emit: emitToolEvent,
          }),
          ...createShellTools({
            getTerminal: options.getTerminal,
            changeTracker: options.changeTracker,
            emit: emitToolEvent,
          }),
          ...createPythonTools({
            getPythonSession: () => options.computer.getOrCreateAgentPythonSession(),
            changeTracker: options.changeTracker,
            emit: emitToolEvent,
          }),
        }

        // Build provider options for extended thinking
        const providerOptions =
          thinking?.type === "enabled"
            ? {
                anthropic: {
                  thinking: {
                    type: "enabled" as const,
                    budgetTokens: thinking.budgetTokens ?? 10000,
                  },
                },
              }
            : undefined

        const agent = new ToolLoopAgent({
          model: anthropic(model),
          instructions: systemPrompt,
          tools,
          providerOptions,
        })

        const result = await agent.stream({
          messages: toModelMessages(options.messages),
          abortSignal: options.signal,
        })

        let currentStepIndex = 0

        for await (const part of result.fullStream) {
          // First, yield any tool events that were queued
          yield* yieldQueuedEvents()

          switch (part.type) {
            case "start-step": {
              yield {
                type: "step-start",
                stepIndex: currentStepIndex,
              }
              break
            }

            case "finish-step": {
              yield {
                type: "step-end",
                stepIndex: currentStepIndex,
                hasToolCalls: part.finishReason === "tool-calls",
              }
              currentStepIndex++
              break
            }

            case "text-delta": {
              yield {
                type: "text-delta",
                content: part.text,
              }
              break
            }

            case "tool-input-start": {
              yield {
                type: "tool-input-start",
                id: part.id,
                name: part.toolName,
              }
              break
            }

            case "tool-input-delta": {
              yield {
                type: "tool-input-delta",
                id: part.id,
                delta: part.delta,
              }
              break
            }

            case "tool-input-end": {
              yield {
                type: "tool-input-end",
                id: part.id,
              }
              break
            }

            case "tool-call": {
              yield {
                type: "tool-call",
                id: part.toolCallId,
                name: part.toolName,
                args: part.input as Record<string, unknown>,
              }
              break
            }

            case "tool-result": {
              // Tool execution happens here, which may emit events to the queue
              yield {
                type: "tool-result",
                id: part.toolCallId,
                name: part.toolName,
                result: part.output,
              }
              // Yield any events emitted during tool execution
              yield* yieldQueuedEvents()
              break
            }

            // Reasoning events (extended thinking)
            case "reasoning-start": {
              yield {
                type: "reasoning-start",
                id: part.id,
              }
              break
            }

            case "reasoning-delta": {
              yield {
                type: "reasoning-delta",
                id: part.id,
                delta: part.text,
              }
              break
            }

            case "reasoning-end": {
              yield {
                type: "reasoning-end",
                id: part.id,
              }
              break
            }
          }
        }

        // Yield any remaining queued events
        yield* yieldQueuedEvents()

        const usage = await result.usage

        yield {
          type: "finish",
          usage: formatUsageStats(usage),
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return
        }

        yield {
          type: "error",
          message: getErrorMessage(error),
        }
      }
    },
  }
}
