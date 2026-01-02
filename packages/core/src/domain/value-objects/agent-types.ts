/**
 * Agent Types Value Objects
 *
 * Types for agent messages, tool invocations, and related structures.
 * These are used across the domain for representing chat interactions.
 */

/** Position in a file */
export interface Position {
  line: number
  column: number
}

/** Range in a file */
export interface Range {
  start: Position
  end: Position
}

/** Token usage statistics */
export interface UsageStats {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** Text part of a message */
export interface TextPart {
  type: "text"
  content: string
  stepIndex: number
}

/** Tool invocation state */
export type ToolInvocationState =
  | "pending"
  | "streaming"
  | "running"
  | "completed"
  | "error"
  | "needs-approval"

/** Tool invocation details */
export interface ToolInvocation {
  id: string
  toolName: string
  args: Record<string, unknown>
  result?: unknown
  state: ToolInvocationState
  error?: string
}

/** Tool part of a message */
export interface ToolPart {
  type: "tool"
  toolInvocation: ToolInvocation
  stepIndex: number
}

/** Part of a message (text or tool) */
export type MessagePart = TextPart | ToolPart

/** Role of message sender */
export type AgentMessageRole = "user" | "assistant" | "system"

/** A message in an agent conversation */
export interface AgentMessage {
  id: string
  role: AgentMessageRole
  content: string
  parts?: MessagePart[]
  toolInvocations?: ToolInvocation[]
  createdAt: Date
}
