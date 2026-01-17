import { readProjectFile } from "@ifc-viewer/sdk"
import { readProjectFileQueryKey } from "@ifc-viewer/sdk/hooks"
import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { useEditor } from "../context"
import { getAvailableViewers } from "../utils/viewer-registry"
import { ViewerSwitcher } from "./viewer-switcher"
import { CodeEditor } from "./viewers/code-editor"
import { HtmlViewer } from "./viewers/html-viewer"
import { MarkdownViewer } from "./viewers/markdown-viewer"
import { PdfViewer } from "./viewers/pdf-viewer"
import { UnsupportedViewer } from "./viewers/unsupported-viewer"

interface EditorPaneProps {
  projectId: string
  onShowTerminal?: () => void
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background text-muted-foreground">
      <div className="text-center">
        <p className="text-sm">No file open</p>
        <p className="text-xs mt-1">Select a file from the explorer</p>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background text-muted-foreground">
      <p className="text-sm">Loading...</p>
    </div>
  )
}

export function EditorPane({ projectId }: EditorPaneProps) {
  const { tabs, activeTabId, getFileContent, setFileContent, setTabViewer } = useEditor()

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const shouldFetchContent = activeTab && !getFileContent(activeTab.path)

  // Query for file content
  const contentQuery = useQuery({
    queryKey: readProjectFileQueryKey({
      path: { id: projectId },
      query: { path: activeTab?.path ?? "" },
    }),
    queryFn: async () => {
      const { data } = await readProjectFile({
        path: { id: projectId },
        query: { path: activeTab!.path },
      })
      return data
    },
    enabled: !!shouldFetchContent,
    staleTime: 30000,
  })

  // Update editor context when content is fetched (only if not already cached)
  useEffect(() => {
    if (contentQuery.data && activeTab && !getFileContent(activeTab.path)) {
      setFileContent(activeTab.path, {
        // SDK generates `type: string` but API always returns "text" | "binary"
        type: contentQuery.data.type as "text" | "binary",
        content: contentQuery.data.content,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentQuery.data, activeTab, getFileContent, setFileContent])

  if (!activeTab) {
    return <EmptyState />
  }

  // Determine effective viewer (user override or default)
  const effectiveViewer = activeTab.activeViewer ?? activeTab.type
  const content = getFileContent(activeTab.path)

  if (contentQuery.isLoading || !content) {
    return <LoadingState />
  }

  // Render viewer with optional switcher
  const renderViewer = () => {
    switch (effectiveViewer) {
      case "markdown":
        return (
          <MarkdownViewer
            content={content.content}
            contentType={content.type}
            filename={activeTab.name}
          />
        )

      case "html":
        return (
          <HtmlViewer
            content={content.content}
            contentType={content.type}
            filename={activeTab.name}
          />
        )

      case "pdf":
        return (
          <PdfViewer
            content={content.content}
            contentType={content.type}
            filename={activeTab.name}
          />
        )

      case "unsupported":
        return <UnsupportedViewer filename={activeTab.name} />

      default:
        return (
          <CodeEditor
            projectId={projectId}
            path={activeTab.path}
            tabId={activeTab.id}
            content={content.content}
            filename={activeTab.name}
          />
        )
    }
  }

  const hasMultipleViewers = getAvailableViewers(activeTab.type).length > 1

  return (
    <div className="h-full relative flex flex-col">
      <div className="flex-1 min-h-0">{renderViewer()}</div>
      {hasMultipleViewers && (
        <div className="flex justify-center py-2 border-t bg-background">
          <ViewerSwitcher
            currentViewer={effectiveViewer}
            defaultViewer={activeTab.type}
            onViewerChange={(viewer) => setTabViewer(activeTab.id, viewer)}
          />
        </div>
      )}
    </div>
  )
}
