"use client";

import { useEffect, useCallback } from "react";
import { useAgent } from "../context";
import { useEditor } from "@/features/editor/context";
import type { AgentEvent } from "@ifc-viewer/agent";
import type { TerminalHandle } from "@/features/terminal/components/terminal";
import type { FileBrowserHandle } from "@/features/file-browser/components/file-browser";

interface UseAgentPresenceOptions {
  terminalRef: React.RefObject<TerminalHandle | null>;
  fileBrowserRef: React.RefObject<FileBrowserHandle | null>;
  onShowTerminal: () => void;
}

export function useAgentPresence({
  terminalRef,
  fileBrowserRef,
  onShowTerminal,
}: UseAgentPresenceOptions) {
  const { onPresenceEvent } = useAgent();
  const { openFile, setFileContent } = useEditor();

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.type) {
        case "editor-open":
          openFile(event.path);
          break;

        case "editor-replace":
          setFileContent(event.path, { type: "text", content: event.content });
          break;

        case "terminal-focus":
          onShowTerminal();
          terminalRef.current?.focus();
          break;

        case "terminal-type":
          terminalRef.current?.typeText(event.text, event.speed);
          break;

        case "terminal-execute":
          terminalRef.current?.execute();
          break;

        case "terminal-output":
          terminalRef.current?.writeOutput(event.data);
          break;

        case "file-created":
        case "file-deleted":
          fileBrowserRef.current?.refreshPath(event.path);
          break;
      }
    },
    [openFile, setFileContent, onShowTerminal, terminalRef, fileBrowserRef]
  );

  useEffect(() => {
    return onPresenceEvent(handleEvent);
  }, [onPresenceEvent, handleEvent]);
}
