import type { Computer } from "@ifc-viewer/computer";
import type { AgentEvent } from "./events";

export interface AgentConfig {
  computer: Computer;
  model?: string;
  maxSteps?: number;
  systemPrompt?: string;
  emit: (event: AgentEvent) => void;
}

// Message parts for sequential rendering
export interface TextPart {
  type: "text";
  content: string;
  stepIndex: number;
}

export interface ToolPart {
  type: "tool";
  toolInvocation: ToolInvocation;
  stepIndex: number;
}

export type MessagePart = TextPart | ToolPart;

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts?: MessagePart[];
  toolInvocations?: ToolInvocation[];
  createdAt: Date;
}

export interface ToolInvocation {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  state: "pending" | "streaming" | "running" | "completed" | "error" | "needs-approval";
  error?: string;
}

export interface Position {
  line: number;
  column: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ToolContext {
  computer: Computer;
  emit: (event: AgentEvent) => void;
}
