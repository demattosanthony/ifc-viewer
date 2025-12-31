/**
 * Terminal WebSocket event types
 */

// Server -> Client events
export interface TerminalReadyEvent {
  type: "ready";
  terminalId: string;
}

export interface TerminalOutputEvent {
  type: "output";
  data: string;
}

export interface TerminalExitEvent {
  type: "exit";
  code: number;
}

export interface TerminalErrorEvent {
  type: "error";
  message: string;
}

export type TerminalServerEvent =
  | TerminalReadyEvent
  | TerminalOutputEvent
  | TerminalExitEvent
  | TerminalErrorEvent;

// Client -> Server events
export interface TerminalInputMessage {
  type: "input";
  data: string;
}

export interface TerminalResizeMessage {
  type: "resize";
  cols: number;
  rows: number;
}

export type TerminalClientMessage = TerminalInputMessage | TerminalResizeMessage;
