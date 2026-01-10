import type { AIEvent } from "@ifc-viewer/core"
import { useCallback, useEffect } from "react"
import { useEditor } from "@/features/editor/context"
import type { FileBrowserHandle } from "@/features/file-browser/components/file-browser"
import { useAgent } from "../context"

interface UseAgentPresenceOptions {
  fileBrowserRef: React.RefObject<FileBrowserHandle | null>
}

export function useAgentPresence({ fileBrowserRef }: UseAgentPresenceOptions) {
  const { onPresenceEvent } = useAgent()
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

        // Terminal events are no longer handled since terminal is not available
        // without a workspace. AI agent now runs compute internally.
        case "terminal-focus":
        case "terminal-type":
        case "terminal-execute":
        case "terminal-output":
          // No-op: terminal is internal to compute
          break
      }
    },
    [openFile, setFileContent, fileBrowserRef]
  )

  useEffect(() => {
    return onPresenceEvent(handleEvent)
  }, [onPresenceEvent, handleEvent])
}
