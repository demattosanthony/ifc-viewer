"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAgent } from "@/lib/agent-context";
import { useEditor } from "@/lib/editor-context";
import type { AgentEvent } from "@ifc-viewer/agent";

interface TerminalControl {
  typeText: (text: string, speed?: number) => void;
  appendText: (text: string) => void;
  startStreamingCommand: () => void;
  execute: () => void;
  writeOutput: (data: string) => void;
  focus: () => void;
}

interface UseAgentPresenceOptions {
  onTerminalFocus?: () => void;
  onFileCreated?: (path: string) => void;
  onFileDeleted?: (path: string) => void;
}

export function useAgentPresence(options: UseAgentPresenceOptions = {}) {
  const { onPresenceEvent } = useAgent();
  const { openFile, setFileContent, getFileContent } = useEditor();
  const terminalControlRef = useRef<TerminalControl | null>(null);

  // Register terminal control
  const registerTerminal = useCallback((control: TerminalControl) => {
    terminalControlRef.current = control;
    return () => {
      terminalControlRef.current = null;
    };
  }, []);

  // Handle agent events
  const handleEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.type) {
        // Editor events
        case "editor-open":
          openFile(event.path);
          break;

        case "editor-replace":
          // Update file content in the editor
          setFileContent(event.path, { type: "text", content: event.content });
          break;

        case "editor-insert": {
          // Append text incrementally during streaming
          const current = getFileContent(event.path);
          if (!current || current.type !== "text") {
            setFileContent(event.path, { type: "text", content: event.text });
          } else {
            // Insert at position - for now, just append to the end
            // A more sophisticated implementation would insert at the exact position
            setFileContent(event.path, { type: "text", content: current.content + event.text });
          }
          break;
        }

        case "editor-cursor":
          // Visual cursor position - could be used for highlighting
          // For now, just ensure the file is open
          openFile(event.path);
          break;

        // Terminal events
        case "terminal-focus":
          options.onTerminalFocus?.();
          terminalControlRef.current?.focus();
          break;

        case "terminal-type":
          terminalControlRef.current?.typeText(event.text, event.speed);
          break;

        case "terminal-append":
          // Append text during streaming (no prefix, no delay)
          terminalControlRef.current?.appendText(event.text);
          break;

        case "terminal-execute":
          terminalControlRef.current?.execute();
          break;

        case "terminal-output":
          terminalControlRef.current?.writeOutput(event.data);
          break;

        // File browser events
        case "file-created":
          options.onFileCreated?.(event.path);
          break;

        case "file-deleted":
          options.onFileDeleted?.(event.path);
          break;
      }
    },
    [openFile, setFileContent, getFileContent, options]
  );

  // Subscribe to presence events
  useEffect(() => {
    return onPresenceEvent(handleEvent);
  }, [onPresenceEvent, handleEvent]);

  return {
    registerTerminal,
  };
}
