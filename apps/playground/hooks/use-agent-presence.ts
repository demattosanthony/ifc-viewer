"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAgent } from "@/lib/agent-context";
import { useEditor } from "@/lib/editor-context";
import type { AgentEvent } from "@ifc-viewer/agent";

interface TerminalControl {
  typeText: (text: string, speed?: number) => void;
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
  const { openFile, setFileContent, updateFileContent } = useEditor();
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

        // Terminal events
        case "terminal-focus":
          options.onTerminalFocus?.();
          terminalControlRef.current?.focus();
          break;

        case "terminal-type":
          terminalControlRef.current?.typeText(event.text, event.speed);
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
    [openFile, setFileContent, options]
  );

  // Subscribe to presence events
  useEffect(() => {
    return onPresenceEvent(handleEvent);
  }, [onPresenceEvent, handleEvent]);

  return {
    registerTerminal,
  };
}
