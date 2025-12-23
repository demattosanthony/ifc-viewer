import type { Position, Range, UsageStats } from "./types";

// Connection events
export interface ReadyEvent {
  type: "ready";
}

// Chat streaming events
export interface TextDeltaEvent {
  type: "text-delta";
  content: string;
}

export interface StartStepEvent {
  type: "start-step";
  stepIndex: number;
}

export interface FinishStepEvent {
  type: "finish-step";
  stepIndex: number;
  hasToolCalls: boolean;
}

export interface FinishEvent {
  type: "finish";
  usage: UsageStats;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

// Tool lifecycle events
export interface ToolInputStartEvent {
  type: "tool-input-start";
  id: string;
  name: string;
}

export interface ToolInputDeltaEvent {
  type: "tool-input-delta";
  id: string;
  delta: string;
}

export interface ToolInputEndEvent {
  type: "tool-input-end";
  id: string;
}

export interface ToolCallEvent {
  type: "tool-call";
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent {
  type: "tool-result";
  id: string;
  name: string;
  result: unknown;
}

export interface NeedsApprovalEvent {
  type: "needs-approval";
  id: string;
  name: string;
  args: Record<string, unknown>;
}

// Editor presence events
export interface EditorOpenEvent {
  type: "editor-open";
  path: string;
}

export interface EditorCursorEvent {
  type: "editor-cursor";
  path: string;
  line: number;
  column: number;
}

export interface EditorInsertEvent {
  type: "editor-insert";
  path: string;
  position: Position;
  text: string;
}

export interface EditorDeleteEvent {
  type: "editor-delete";
  path: string;
  range: Range;
}

export interface EditorSaveEvent {
  type: "editor-save";
  path: string;
}

export interface EditorReplaceEvent {
  type: "editor-replace";
  path: string;
  content: string;
}

// Terminal presence events
export interface TerminalFocusEvent {
  type: "terminal-focus";
}

export interface TerminalTypeEvent {
  type: "terminal-type";
  text: string;
  speed?: number;
}

export interface TerminalExecuteEvent {
  type: "terminal-execute";
}

export interface TerminalOutputEvent {
  type: "terminal-output";
  data: string;
}

// File browser events
export interface FileCreatedEvent {
  type: "file-created";
  path: string;
}

export interface FileDeletedEvent {
  type: "file-deleted";
  path: string;
}

// Union type of all events
export type AgentEvent =
  | ReadyEvent
  | TextDeltaEvent
  | StartStepEvent
  | FinishStepEvent
  | FinishEvent
  | ErrorEvent
  | ToolInputStartEvent
  | ToolInputDeltaEvent
  | ToolInputEndEvent
  | ToolCallEvent
  | ToolResultEvent
  | NeedsApprovalEvent
  | EditorOpenEvent
  | EditorCursorEvent
  | EditorInsertEvent
  | EditorDeleteEvent
  | EditorSaveEvent
  | EditorReplaceEvent
  | TerminalFocusEvent
  | TerminalTypeEvent
  | TerminalExecuteEvent
  | TerminalOutputEvent
  | FileCreatedEvent
  | FileDeletedEvent;

// Client -> Server message types
export interface ChatMessage {
  type: "chat";
  content: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface StopMessage {
  type: "stop";
}

export interface ApproveToolMessage {
  type: "approve-tool";
  toolCallId: string;
}

export interface RejectToolMessage {
  type: "reject-tool";
  toolCallId: string;
}

export type ClientMessage =
  | ChatMessage
  | StopMessage
  | ApproveToolMessage
  | RejectToolMessage;
