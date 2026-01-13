import { useViewer, Viewer } from "@ifc-viewer/viewer"
import { useCallback } from "react"
import { ChatPanel } from "@/features/agent/components/chat-panel"
import { useResizable } from "@/features/editor/hooks/use-resizable"
import { ElementPropertiesPanel } from "@/features/ifc-viewer/components/element-properties-panel"
import { ViewerToolBar } from "@/features/ifc-viewer/components/viewer-toolbar"
import { useElementSelection } from "@/features/ifc-viewer/hooks/use-element-selection"
import { SpatialHierarchySidebar } from "./spatial-hierarchy-sidebar"

interface ViewerModeLayoutProps {
  projectId: string
}

export function ViewerModeLayout({ projectId }: ViewerModeLayoutProps) {
  const { selectElements, isInitialized } = useViewer()
  const { selectedElement, setSelectedElement, clearSelection, getElement } = useElementSelection()

  const { size: chatWidth, handleResizeStart: handleChatResizeStart } = useResizable({
    initialSize: 400,
    minSize: 280,
    maxSize: 650,
    direction: "horizontal",
    side: "right",
    storageKey: "ifc-viewer:chat-sidebar-width",
  })

  const { size: sidebarWidth, handleResizeStart: handleSidebarResizeStart } = useResizable({
    initialSize: 280,
    minSize: 200,
    maxSize: 450,
    direction: "horizontal",
    side: "left",
    storageKey: "ifc-viewer:left-sidebar-width",
  })

  // Handle selection from hierarchy sidebar
  const handleElementSelect = useCallback(
    async (modelId: string, localId: number) => {
      if (isInitialized && selectElements) {
        await selectElements(modelId, [localId])
      }
      const element = await getElement(modelId, localId)
      if (element) {
        setSelectedElement({ data: element as Record<string, unknown> })
      }
    },
    [getElement, selectElements, isInitialized, setSelectedElement]
  )

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Sidebar - Spatial Hierarchy */}
      <div className="relative shrink-0 border-r bg-background" style={{ width: sidebarWidth }}>
        <SpatialHierarchySidebar projectId={projectId} onElementSelect={handleElementSelect} />
        <div
          onMouseDown={handleSidebarResizeStart}
          className="absolute top-0 right-0 bottom-0 w-1 cursor-ew-resize z-20 group"
        >
          <div className="absolute inset-y-0 right-0 w-0.5 group-hover:w-1 bg-border group-hover:bg-primary transition-colors" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {/* Viewer */}
        <div className="flex-1 min-w-0 relative">
          <Viewer />
          <ViewerToolBar />
          <ElementPropertiesPanel
            element={selectedElement?.data ?? null}
            onClose={clearSelection}
          />
        </div>

        {/* Chat Panel */}
        <div className="relative shrink-0 border-l bg-background" style={{ width: chatWidth }}>
          <div
            onMouseDown={handleChatResizeStart}
            className="absolute top-0 left-0 bottom-0 w-2 cursor-ew-resize z-20 group"
          >
            <div className="absolute inset-y-0 left-0 w-0.5 group-hover:w-1 bg-border group-hover:bg-primary transition-colors" />
          </div>
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}
