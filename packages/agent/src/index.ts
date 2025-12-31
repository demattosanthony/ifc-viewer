export { BimAgent, createAgent } from "./agent";
export type { BimAgentConfig } from "./agent";

export { BIM_IDE_SYSTEM_PROMPT } from "./prompts/system-prompt";

export type {
  AgentMessage,
  MessagePart,
  TextPart,
  ToolPart,
  ToolInvocation,
  Position,
  Range,
  UsageStats,
} from "./types";

// Events
export type {
  AgentEvent,
  ClientMessage,
  ReadyEvent,
  TextDeltaEvent,
  StartStepEvent,
  FinishStepEvent,
  FinishEvent,
  ErrorEvent,
  ToolInputStartEvent,
  ToolInputDeltaEvent,
  ToolInputEndEvent,
  ToolCallEvent,
  ToolResultEvent,
  NeedsApprovalEvent,
  EditorOpenEvent,
  EditorCursorEvent,
  EditorInsertEvent,
  EditorDeleteEvent,
  EditorSaveEvent,
  EditorReplaceEvent,
  TerminalFocusEvent,
  TerminalTypeEvent,
  TerminalExecuteEvent,
  TerminalOutputEvent,
  TerminalAppendEvent,
  FileCreatedEvent,
  FileDeletedEvent,
  ChatMessage,
  StopMessage,
  ApproveToolMessage,
  RejectToolMessage,
} from "./events";
