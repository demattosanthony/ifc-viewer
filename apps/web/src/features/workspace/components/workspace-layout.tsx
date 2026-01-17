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
import { FilePickerModal } from "@/features/file-browser/components/file-picker-modal"
import { Terminal } from "@/features/terminal"
import { usePersistedState } from "@/shared/hooks/use-persisted-state"
import { ViewerContainer } from "./viewer-container"

interface WorkspaceLayoutProps {
  projectId: string
}

export function WorkspaceLayout({ projectId }: WorkspaceLayoutProps) {
  const { tabs, activeTabId, openFile } = useEditor()
  const [showSidebar, setShowSidebar] = usePersistedState("ifc-viewer:sidebar-visible", false)
  const [showTerminal, setShowTerminal] = usePersistedState("ifc-viewer:terminal-visible", false)
  const [showChat, setShowChat] = usePersistedState("ifc-viewer:chat-visible", true)
  const [filePickerOpen, setFilePickerOpen] = useState(false)
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

  const handleFileSelect = (path: string) => {
    openFile(path)
    setFilePickerOpen(false)
  }

  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Determine which view to show
  const showFederatedViewer = !activeTab // Models tab (no active file tab)
  const showIfcFileViewer = activeTab?.type === "ifc" // Individual IFC file tab
  const showOtherFileViewer = activeTab && activeTab.type !== "ifc" // Non-IFC file tab

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* File Browser Sidebar */}
      <FileBrowser ref={fileBrowserRef} projectId={projectId} visible={showSidebar} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Tab Bar */}
        <TabBar
          showSidebar={showSidebar}
          showTerminal={showTerminal}
          showChat={showChat}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
          onToggleTerminal={() => setShowTerminal(!showTerminal)}
          onToggleChat={() => setShowChat(!showChat)}
          onAddTab={() => setFilePickerOpen(true)}
        />

        {/* Content Area */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {/* Main Viewer - for Models tab (always mounted, visibility toggled) */}
          <ViewerContainer
            projectId={projectId}
            variant="federated"
            visible={showFederatedViewer}
          />

          {/* Single File Viewer - for individual IFC file tabs */}
          {showIfcFileViewer && activeTab && (
            <ViewerContainer
              projectId={projectId}
              variant="single-file"
              filePath={activeTab.path}
            />
          )}

          {/* Other file types (code editor, PDF, etc.) */}
          {showOtherFileViewer && (
            <div className="absolute inset-0 z-10 bg-background">
              <EditorPane projectId={projectId} />
            </div>
          )}
        </div>

        {/* Terminal Panel */}
        {showTerminal && (
          <div className="relative shrink-0" style={{ height: terminalHeight }}>
            <div
              onMouseDown={handleTerminalResizeStart}
              className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-20 group"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 group-hover:h-1 bg-border group-hover:bg-primary-foreground transition-colors" />
            </div>
            <Terminal projectId={projectId} onClose={() => setShowTerminal(false)} />
          </div>
        )}
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="relative shrink-0 border-l bg-background" style={{ width: chatWidth }}>
          <div
            onMouseDown={handleChatResizeStart}
            className="absolute top-0 left-0 bottom-0 w-2 cursor-ew-resize z-20 group"
          >
            <div className="absolute inset-y-0 left-0 w-0.5 group-hover:w-1 bg-border group-hover:bg-primary-foreground transition-colors" />
          </div>
          <ChatPanel onClose={() => setShowChat(false)} />
        </div>
      )}

      {/* File Picker Modal */}
      <FilePickerModal
        projectId={projectId}
        open={filePickerOpen}
        onOpenChange={setFilePickerOpen}
        onFileSelect={handleFileSelect}
      />
    </div>
  )
}
