// Main exports
export { BimAgent, createAgent } from "./agent";
export type { BimAgentConfig } from "./agent";

// Tools
export { createFileTools } from "./tools/file-tools";
export { createShellTools } from "./tools/shell-tools";

// Prompts
export { BIM_IDE_SYSTEM_PROMPT, PROMPTS } from "./prompts/system-prompt";

// Types
export type {
  AgentConfig,
  AgentMessage,
  MessagePart,
  TextPart,
  ToolPart,
  ToolInvocation,
  Position,
  Range,
  UsageStats,
  ToolContext,
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
  FileCreatedEvent,
  FileDeletedEvent,
  ChatMessage,
  StopMessage,
  ApproveToolMessage,
  RejectToolMessage,
} from "./events";
