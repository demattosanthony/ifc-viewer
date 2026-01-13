import { Viewer } from "@ifc-viewer/viewer"
import { useRef, useState } from "react"
import { ChatPanel } from "@/features/agent/components/chat-panel"
import { useAgentPresence } from "@/features/agent/hooks/use-agent-presence"
import { EditorPane } from "@/features/editor/components/editor-pane"
import { TabBar } from "@/features/editor/components/tab-bar"
import { useEditor } from "@/features/editor/context"
import { useResizable } from "@/features/editor/hooks/use-resizable"
import {
  FileBrowser,
  type FileBrowserHandle,
} from "@/features/file-browser/components/file-browser"
import { ElementPropertiesPanel } from "@/features/ifc-viewer/components/element-properties-panel"
import { ViewerToolBar } from "@/features/ifc-viewer/components/viewer-toolbar"
import { useElementSelection } from "@/features/ifc-viewer/hooks/use-element-selection"
import { Terminal } from "@/features/terminal"

interface EditorModeLayoutProps {
  projectId: string
}

export function EditorModeLayout({ projectId }: EditorModeLayoutProps) {
  const { tabs, activeTabId } = useEditor()
  const { selectedElement, clearSelection } = useElementSelection()
  const [showSidebar, setShowSidebar] = useState(true)
  const [showTerminal, setShowTerminal] = useState(false)
  const [showChat, setShowChat] = useState(true)
  const fileBrowserRef = useRef<FileBrowserHandle | null>(null)

  useAgentPresence({ fileBrowserRef })

  const { size: chatWidth, handleResizeStart: handleChatResizeStart } = useResizable({
    initialSize: 400,
    minSize: 280,
    maxSize: 650,
    direction: "horizontal",
    side: "right",
    storageKey: "ifc-viewer:chat-sidebar-width",
  })

  const { size: terminalHeight, handleResizeStart: handleTerminalResizeStart } = useResizable({
    initialSize: 250,
    minSize: 120,
    maxSize: 500,
    direction: "vertical",
    side: "bottom",
  })

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const isIfcActive = activeTab?.type === "ifc"

  return (
    <div className="flex-1 flex overflow-hidden">
      <FileBrowser ref={fileBrowserRef} projectId={projectId} visible={showSidebar} />

      {/* Main content area with TabBar */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TabBar
          showSidebar={showSidebar}
          showTerminal={showTerminal}
          showChat={showChat}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
          onToggleTerminal={() => setShowTerminal(!showTerminal)}
          onToggleChat={() => setShowChat(!showChat)}
        />

        <div className="flex-1 min-h-0 relative overflow-hidden">
          {/* IFC Viewer - always mounted, visibility controlled */}
          <div className={`absolute inset-0 ${isIfcActive ? "visible" : "invisible"}`}>
            <Viewer />
            <ViewerToolBar />
            {isIfcActive && (
              <ElementPropertiesPanel
                element={selectedElement?.data ?? null}
                onClose={clearSelection}
              />
            )}
          </div>

          {/* Code Editor / Other content - layered on top when active */}
          {!isIfcActive && activeTab && (
            <div className="absolute inset-0 z-10">
              <EditorPane projectId={projectId} />
            </div>
          )}

          {/* Empty state when no tabs */}
          {!activeTab && (
            <div className="absolute inset-0 flex items-center justify-center bg-background text-muted-foreground">
              <div className="text-center">
                <p className="text-sm">No file open</p>
                <p className="text-xs mt-1">Select a file from the explorer</p>
              </div>
            </div>
          )}

          {/* IFC Loader - triggers model loading when IFC tab is active */}
          {isIfcActive && <EditorPane projectId={projectId} />}
        </div>

        {/* Terminal Panel */}
        {showTerminal && (
          <div className="relative shrink-0" style={{ height: terminalHeight }}>
            <div
              onMouseDown={handleTerminalResizeStart}
              className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-20 group"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 group-hover:h-1 bg-border group-hover:bg-primary transition-colors" />
            </div>
            <Terminal projectId={projectId} onClose={() => setShowTerminal(false)} />
          </div>
        )}
      </div>

      {/* Chat Panel - separate from main content */}
      {showChat && (
        <div className="relative shrink-0 border-l bg-background" style={{ width: chatWidth }}>
          <div
            onMouseDown={handleChatResizeStart}
            className="absolute top-0 left-0 bottom-0 w-2 cursor-ew-resize z-20 group"
          >
            <div className="absolute inset-y-0 left-0 w-0.5 group-hover:w-1 bg-border group-hover:bg-primary transition-colors" />
          </div>
          <ChatPanel onClose={() => setShowChat(false)} />
        </div>
      )}
    </div>
  )
}
