/**
 * AI Provider Port
 *
 * Abstract interface for AI/LLM providers. Implementations handle
 * the specifics of each provider (Anthropic, OpenAI, etc).
 */

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
  /** Callback for events (allows tools to emit UI events) */
  onEvent?: (event: AIEvent) => void
}

/** Message in conversation */
export interface AIMessage {
  role: "user" | "assistant" | "system"
  content: string
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

/** Ready event - connection established */
export interface AIReadyEvent {
  type: "ready"
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

// UI presence events (emitted by tools for frontend updates)
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

/** Union type of all AI events */
export type AIEvent =
  | AIReadyEvent
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

// ============================================================================
// Client -> Server messages
// ============================================================================

export interface AIChatMessage {
  type: "chat"
  content: string
  history?: Array<{ role: "user" | "assistant"; content: string }>
}

export interface AIStopMessage {
  type: "stop"
}

export interface AIApproveToolMessage {
  type: "approve-tool"
  toolCallId: string
}

export interface AIRejectToolMessage {
  type: "reject-tool"
  toolCallId: string
}

export type AIClientMessage =
  | AIChatMessage
  | AIStopMessage
  | AIApproveToolMessage
  | AIRejectToolMessage

// ============================================================================
// Terminal WebSocket Events (for direct terminal connections)
// ============================================================================

/** Terminal ready event - connection established */
export interface TerminalReadyEvent {
  type: "ready"
  terminalId: string
}

/** Terminal output event - data from PTY */
export interface TerminalDataEvent {
  type: "output"
  data: string
}

/** Terminal exit event - process terminated */
export interface TerminalExitEvent {
  type: "exit"
  code: number
}

/** Terminal error event */
export interface TerminalErrorEvent {
  type: "error"
  message: string
}

/** Server -> Client terminal events */
export type TerminalServerEvent =
  | TerminalReadyEvent
  | TerminalDataEvent
  | TerminalExitEvent
  | TerminalErrorEvent

/** Client -> Server terminal input */
export interface TerminalInputMessage {
  type: "input"
  data: string
}

/** Client -> Server terminal resize */
export interface TerminalResizeMessage {
  type: "resize"
  cols: number
  rows: number
}

/** Client -> Server terminal messages */
export type TerminalClientMessage = TerminalInputMessage | TerminalResizeMessage

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
