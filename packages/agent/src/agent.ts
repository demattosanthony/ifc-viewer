import { ToolLoopAgent, type ModelMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { Computer, TerminalSession } from "@ifc-viewer/computer";
import { createFileTools } from "./tools/file-tools";
import { createShellTools } from "./tools/shell-tools";
import { BIM_IDE_SYSTEM_PROMPT } from "./prompts/system-prompt";
import type { UsageStats } from "./types";
import type { AgentEvent } from "./events";
import { getErrorMessage, formatUsageStats } from "./utils";

const anthropic = createAnthropic({
  headers: {
    "anthropic-beta": "fine-grained-tool-streaming-2025-05-14",
  },
});

export interface BimAgentConfig {
  computer: Computer;
  getTerminal: () => Promise<TerminalSession>;
  model?: string;
  systemPrompt?: string;
}

export class BimAgent {
  private computer: Computer;
  private getTerminal: () => Promise<TerminalSession>;
  private model: string;
  private systemPrompt: string;

  constructor(config: BimAgentConfig) {
    this.computer = config.computer;
    this.getTerminal = config.getTerminal;
    this.model = config.model ?? "claude-sonnet-4-5";
    this.systemPrompt = config.systemPrompt ?? BIM_IDE_SYSTEM_PROMPT;
  }

  private createTools(emit: (event: AgentEvent) => void) {
    return {
      ...createFileTools(this.computer, emit),
      ...createShellTools(this.getTerminal, emit),
    };
  }

  private createAgentInstance(emit: (event: AgentEvent) => void) {
    const tools = this.createTools(emit);

    return new ToolLoopAgent({
      model: anthropic(this.model),
      instructions: this.systemPrompt,
      tools,
    });
  }

  async *streamChat(
    messages: ModelMessage[],
    emit: (event: AgentEvent) => void,
    abortSignal?: AbortSignal
  ): AsyncGenerator<AgentEvent> {
    try {
      const agent = this.createAgentInstance(emit);

      const result = await agent.stream({
        messages,
        abortSignal,
      });

      // Track current step index
      let currentStepIndex = 0;

      // Use fullStream to get all events including tool calls
      for await (const part of result.fullStream) {
        switch (part.type) {
          case "start-step":
            emit({
              type: "start-step",
              stepIndex: currentStepIndex,
            });
            break;

          case "finish-step":
            emit({
              type: "finish-step",
              stepIndex: currentStepIndex,
              hasToolCalls: part.finishReason === "tool-calls",
            });
            currentStepIndex++;
            break;

          case "text-delta":
            const textEvent: AgentEvent = {
              type: "text-delta",
              content: part.text,
            };
            emit(textEvent);
            yield textEvent;
            break;

          case "tool-input-start":
            emit({
              type: "tool-input-start",
              id: part.id,
              name: part.toolName,
            });
            break;

          case "tool-input-delta":
            emit({
              type: "tool-input-delta",
              id: part.id,
              delta: part.delta,
            });
            break;

          case "tool-input-end":
            emit({
              type: "tool-input-end",
              id: part.id,
            });
            break;

          case "tool-call":
            emit({
              type: "tool-call",
              id: part.toolCallId,
              name: part.toolName,
              args: part.input as Record<string, unknown>,
            });
            break;

          case "tool-result":
            emit({
              type: "tool-result",
              id: part.toolCallId,
              name: part.toolName,
              result: part.output,
            });
            break;
        }
      }

      // Get final result for usage stats
      const usage = await result.usage;

      const finishEvent: AgentEvent = {
        type: "finish",
        usage: formatUsageStats(usage),
      };
      emit(finishEvent);
      yield finishEvent;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Chat was cancelled, don't emit error
        return;
      }

      const errorEvent: AgentEvent = {
        type: "error",
        message: getErrorMessage(error),
      };
      emit(errorEvent);
      yield errorEvent;
    }
  }

  // Non-streaming version for simple use cases
  async chat(
    messages: ModelMessage[],
    emit: (event: AgentEvent) => void
  ): Promise<{
    text: string;
    usage: UsageStats;
    toolCalls: Array<{
      id: string;
      name: string;
      args: unknown;
      result: unknown;
    }>;
  }> {
    const agent = this.createAgentInstance(emit);
    const allToolCalls: Array<{
      id: string;
      name: string;
      args: unknown;
      result: unknown;
    }> = [];

    const result = await agent.generate({
      messages,
    });

    // Collect tool calls from steps
    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls) {
          for (const call of step.toolCalls) {
            const matchingResult = step.toolResults?.find(
              (r) => r.toolCallId === call.toolCallId
            );
            allToolCalls.push({
              id: call.toolCallId,
              name: call.toolName,
              args: call.input,
              result: matchingResult?.output,
            });
          }
        }
      }
    }

    return {
      text: result.text,
      usage: formatUsageStats(result.usage),
      toolCalls: allToolCalls,
    };
  }
}

export function createAgent(config: BimAgentConfig): BimAgent {
  return new BimAgent(config);
}
