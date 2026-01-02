/**
 * Realtime Events
 *
 * Re-exports AI events from core for convenience, plus terminal-specific events.
 */

// Re-export AI events from core
export type {
  AIEvent as AgentEvent,
  AIClientMessage as ClientMessage,
  AIReadyEvent as ReadyEvent,
  AITextDeltaEvent as TextDeltaEvent,
  AIStepStartEvent as StartStepEvent,
  AIStepEndEvent as FinishStepEvent,
  AIFinishEvent as FinishEvent,
  AIErrorEvent as ErrorEvent,
  AIToolInputStartEvent as ToolInputStartEvent,
  AIToolInputDeltaEvent as ToolInputDeltaEvent,
  AIToolInputEndEvent as ToolInputEndEvent,
  AIToolCallEvent as ToolCallEvent,
  AIToolResultEvent as ToolResultEvent,
  AIToolNeedsApprovalEvent as NeedsApprovalEvent,
  AIEditorOpenEvent as EditorOpenEvent,
  AIEditorCursorEvent as EditorCursorEvent,
  AIEditorInsertEvent as EditorInsertEvent,
  AIEditorDeleteEvent as EditorDeleteEvent,
  AIEditorSaveEvent as EditorSaveEvent,
  AIEditorReplaceEvent as EditorReplaceEvent,
  AITerminalFocusEvent as TerminalFocusEvent,
  AITerminalTypeEvent as TerminalTypeEvent,
  AITerminalExecuteEvent as TerminalExecuteEvent,
  AITerminalOutputEvent as TerminalOutputEvent,
  AITerminalAppendEvent as TerminalAppendEvent,
  AIFileCreatedEvent as FileCreatedEvent,
  AIFileDeletedEvent as FileDeletedEvent,
  AIChatMessage as ChatMessage,
  AIStopMessage as StopMessage,
  AIApproveToolMessage as ApproveToolMessage,
  AIRejectToolMessage as RejectToolMessage,
} from "@ifc-viewer/core"

// Terminal-specific events
export * from "./terminal-events"
