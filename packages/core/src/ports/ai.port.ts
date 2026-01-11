/**
 * AI Provider Port
 *
 * Abstract interface for AI/LLM providers. Implementations handle
 * the specifics of each provider (Anthropic, OpenAI, etc).
 */

import type { ChangeTracker } from "../services/change-tracker"
import type { Computer, TerminalSession } from "./compute.port"

/** Configuration for AI provider */
export interface AIProviderConfig {
  /** Model identifier (e.g., "claude-sonnet-4-5", "gpt-4") */
  model?: string
  /** Maximum tokens to generate */
  maxTokens?: number
  /** Temperature for sampling */
  temperature?: number
}

/** Options for a single chat request */
export interface AIChatOptions {
  /** Message history */
  messages: AIMessage[]
  /** Abort signal for cancellation */
  signal?: AbortSignal
  /** Computer for file/shell operations */
  computer: Computer
  /** Terminal session factory */
  getTerminal: () => Promise<TerminalSession>
  /** Change tracker for recording file changes (persisted later) */
  changeTracker: ChangeTracker
  /** Callback for events (allows tools to emit UI events) */
  onEvent?: (event: AIEvent) => void
}

// ============================================================================
// AI Message Types (for AI SDK compatibility)
// ============================================================================

/** Text part of an AI message */
export interface AIMessageTextPart {
  type: "text"
  text: string
}

/** Tool call part of an AI message (matches SDK's ToolCallPart) */
export interface AIMessageToolCallPart {
  type: "tool-call"
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
}

/** Tool result part of an AI message (matches SDK's ToolResultPart) */
export interface AIMessageToolResultPart {
  type: "tool-result"
  toolCallId: string
  toolName: string
  output: unknown
}

/** Message content can be string or parts array */
export type AIMessageContent =
  | string
  | (AIMessageTextPart | AIMessageToolCallPart)[]
  | AIMessageToolResultPart[]

/** Message in conversation */
export interface AIMessage {
  role: "user" | "assistant" | "system" | "tool"
  content: AIMessageContent
}

/** Token usage statistics */
export interface AIUsageStats {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

// ============================================================================
// AI Stream Events (Domain-level, provider-agnostic)
// ============================================================================

/** Ready event - connection established (deprecated, use stream-start) */
export interface AIReadyEvent {
  type: "ready"
}

/** Stream start event - includes stream ID for reconnection */
export interface AIStreamStartEvent {
  type: "stream-start"
  streamId: string
  sequence: number
}

/** Replay start event - sent when replaying a stream */
export interface AIReplayStartEvent {
  type: "replay-start"
  streamId: string
  status: string
  fromSequence: number
}

/** Replay end event - sent when replay is complete */
export interface AIReplayEndEvent {
  type: "replay-end"
  status: string
}

/** Text delta event - streaming text content */
export interface AITextDeltaEvent {
  type: "text-delta"
  content: string
}

/** Step start event */
export interface AIStepStartEvent {
  type: "step-start"
  stepIndex: number
}

/** Step end event */
export interface AIStepEndEvent {
  type: "step-end"
  stepIndex: number
  hasToolCalls: boolean
}

/** Finish event - completion done */
export interface AIFinishEvent {
  type: "finish"
  usage: AIUsageStats
}

/** Error event */
export interface AIErrorEvent {
  type: "error"
  message: string
}

// Tool lifecycle events
export interface AIToolInputStartEvent {
  type: "tool-input-start"
  id: string
  name: string
}

export interface AIToolInputDeltaEvent {
  type: "tool-input-delta"
  id: string
  delta: string
}

export interface AIToolInputEndEvent {
  type: "tool-input-end"
  id: string
}

export interface AIToolCallEvent {
  type: "tool-call"
  id: string
  name: string
  args: Record<string, unknown>
}

export interface AIToolResultEvent {
  type: "tool-result"
  id: string
  name: string
  result: unknown
}

export interface AIToolNeedsApprovalEvent {
  type: "needs-approval"
  id: string
  name: string
  args: Record<string, unknown>
}

export type AIStreamEvent =
  | AIReadyEvent
  | AIStreamStartEvent
  | AIReplayStartEvent
  | AIReplayEndEvent
  | AITextDeltaEvent
  | AIStepStartEvent
  | AIStepEndEvent
  | AIFinishEvent
  | AIErrorEvent
  | AIToolInputStartEvent
  | AIToolInputDeltaEvent
  | AIToolInputEndEvent
  | AIToolCallEvent
  | AIToolResultEvent
  | AIToolNeedsApprovalEvent

// AI Presence Events (emitted by tools for frontend updates)
export interface AIEditorOpenEvent {
  type: "editor-open"
  path: string
}

export interface AIEditorCursorEvent {
  type: "editor-cursor"
  path: string
  line: number
  column: number
}

export interface AIEditorInsertEvent {
  type: "editor-insert"
  path: string
  position: { line: number; column: number }
  text: string
}

export interface AIEditorDeleteEvent {
  type: "editor-delete"
  path: string
  range: { start: { line: number; column: number }; end: { line: number; column: number } }
}

export interface AIEditorSaveEvent {
  type: "editor-save"
  path: string
}

export interface AIEditorReplaceEvent {
  type: "editor-replace"
  path: string
  content: string
}

export interface AITerminalFocusEvent {
  type: "terminal-focus"
}

export interface AITerminalTypeEvent {
  type: "terminal-type"
  text: string
  speed?: number
}

export interface AITerminalExecuteEvent {
  type: "terminal-execute"
}

export interface AITerminalOutputEvent {
  type: "terminal-output"
  data: string
}

export interface AITerminalAppendEvent {
  type: "terminal-append"
  text: string
}

export interface AIFileCreatedEvent {
  type: "file-created"
  path: string
}

export interface AIFileDeletedEvent {
  type: "file-deleted"
  path: string
}

export type AIPresenceEvent =
  | AIEditorOpenEvent
  | AIEditorCursorEvent
  | AIEditorInsertEvent
  | AIEditorDeleteEvent
  | AIEditorSaveEvent
  | AIEditorReplaceEvent
  | AITerminalFocusEvent
  | AITerminalTypeEvent
  | AITerminalExecuteEvent
  | AITerminalOutputEvent
  | AITerminalAppendEvent
  | AIFileCreatedEvent
  | AIFileDeletedEvent

export type AIEvent = AIStreamEvent | AIPresenceEvent

/**
 * AI Provider Port
 *
 * Abstracts LLM providers for the agent service.
 */
export interface AIProvider {
  /** Provider identifier */
  readonly id: string

  /**
   * Stream a chat completion with tool use support.
   * Yields events as the model generates.
   */
  streamChat(options: AIChatOptions): AsyncGenerator<AIEvent>
}
