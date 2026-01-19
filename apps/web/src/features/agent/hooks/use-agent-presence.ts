/**
 * Agent Presence Hook
 *
 * Handles non-viewer presence events from the AI agent (editor, files, terminal).
 * For viewer events, use useAgentViewerPresence inside a ViewerProvider.
 */

import type { AIEvent } from "@ifc-viewer/core"
import { useCallback, useEffect } from "react"
import { useEditor } from "@/features/editor/context"
import type { FileBrowserHandle } from "@/features/file-browser/components/file-browser"
import { useAgentStore } from "../context"

interface UseAgentPresenceOptions {
  fileBrowserRef: React.RefObject<FileBrowserHandle | null>
}

export function useAgentPresence({ fileBrowserRef }: UseAgentPresenceOptions) {
  const { onPresenceEvent } = useAgentStore()
  const { openFile, setFileContent } = useEditor()

  const handleEvent = useCallback(
    (event: AIEvent) => {
      switch (event.type) {
        case "editor-open":
          openFile(event.path)
          break

        case "editor-replace":
          setFileContent(event.path, { type: "text", content: event.content })
          break

        case "file-created":
        case "file-deleted":
          fileBrowserRef.current?.refreshPath(event.path)
          break

        // Terminal events - no-op since terminal is internal to compute
        case "terminal-focus":
        case "terminal-type":
        case "terminal-execute":
        case "terminal-output":
          break

        // viewer-exec is handled by useAgentViewerPresence inside ViewerProvider
        case "viewer-exec":
          break
      }
    },
    [openFile, setFileContent, fileBrowserRef]
  )

  useEffect(() => {
    return onPresenceEvent(handleEvent)
  }, [onPresenceEvent, handleEvent])
}
