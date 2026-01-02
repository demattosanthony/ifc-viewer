import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  useViewer,
  useViewerEvents,
  Viewer,
  ViewerProvider,
  type ElementSelectedEvent,
} from "@ifc-viewer/viewer";
import { createWorkspaceMutation } from "@ifc-viewer/sdk/hooks";
import { ViewerToolBar } from "@/features/ifc-viewer/components/viewer-toolbar";
import { ElementPropertiesPanel } from "@/features/ifc-viewer/components/element-properties-panel";
import Terminal, {
  type TerminalHandle,
} from "@/features/terminal/components/terminal";
import {
  FileBrowser,
  type FileBrowserHandle,
} from "@/features/file-browser/components/file-browser";
import { TabBar } from "@/features/editor/components/tab-bar";
import { EditorPane } from "@/features/editor/components/editor-pane";
import { EditorProvider, useEditor } from "@/features/editor/context";
import { AgentProvider } from "@/features/agent/context";
import { useAgentPresence } from "@/features/agent/hooks/use-agent-presence";
import { ChatPanel } from "@/features/agent/components/chat-panel";
import { useResizable } from "@/features/editor/hooks/use-resizable";
import "@xterm/xterm/css/xterm.css";
import { ThemeProvider } from "./shared/components/theme-provider";

interface SelectedElement {
  data: Record<string, unknown>;
}

interface MainContentProps {
  workspaceId: string;
  showSidebar: boolean;
  showTerminal: boolean;
  showChat: boolean;
  terminalRef: React.RefObject<TerminalHandle | null>;
  fileBrowserRef: React.RefObject<FileBrowserHandle | null>;
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
  onToggleChat: () => void;
  onShowTerminal: () => void;
}

function MainContent({
  workspaceId,
  showSidebar,
  showTerminal,
  showChat,
  terminalRef,
  fileBrowserRef,
  onToggleSidebar,
  onToggleTerminal,
  onToggleChat,
  onShowTerminal,
}: MainContentProps) {
  const { getElement } = useViewer();
  const { tabs, activeTabId } = useEditor();
  const [selectedElement, setSelectedElement] =
    useState<SelectedElement | null>(null);

  useAgentPresence({ terminalRef, fileBrowserRef, onShowTerminal });

  const { size: terminalHeight, handleResizeStart: handleTerminalResizeStart } =
    useResizable({
      initialSize: 300,
      minSize: 150,
      maxSize: typeof window !== "undefined" ? window.innerHeight - 200 : 600,
      direction: "vertical",
      side: "bottom",
    });

  const { size: chatWidth, handleResizeStart: handleChatResizeStart } =
    useResizable({
      initialSize: 400,
      minSize: 280,
      maxSize: 600,
      direction: "horizontal",
      side: "right",
    });

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isIfcActive = activeTab?.type === "ifc";

  useViewerEvents({
    onElementSelected: useCallback(
      async (event: ElementSelectedEvent) => {
        const entries = Object.entries(event.modelIdMap);
        if (entries.length === 0) {
          setSelectedElement(null);
          return;
        }
        for (const [modelId, localIdSet] of entries) {
          for (const localId of localIdSet) {
            const element = await getElement(modelId, localId);
            if (element) {
              setSelectedElement({
                data: element as Record<string, unknown>,
              });
              return;
            }
          }
        }
      },
      [getElement]
    ),
  });

  const handleClosePanel = useCallback(() => {
    setSelectedElement(null);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <TabBar
        showSidebar={showSidebar}
        showTerminal={showTerminal}
        showChat={showChat}
        onToggleSidebar={onToggleSidebar}
        onToggleTerminal={onToggleTerminal}
        onToggleChat={onToggleChat}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 min-h-0 relative overflow-hidden">
            {/* IFC Viewer - always mounted, visibility controlled */}
            <div
              className={`absolute inset-0 ${
                isIfcActive ? "visible" : "invisible"
              }`}
            >
              <Viewer />
              <ViewerToolBar />
            </div>

            {/* Code Editor / Other content - layered on top when active */}
            {!isIfcActive && activeTab && (
              <div className="absolute inset-0 z-10">
                <EditorPane workspaceId={workspaceId} />
              </div>
            )}

            {/* Empty state when no tabs */}
            {!activeTab && (
              <div className="absolute inset-0 flex items-center justify-center bg-background text-muted-foreground">
                <div className="text-center">
                  <p className="text-sm">No file open</p>
                  <p className="text-xs mt-1">
                    Select a file from the explorer
                  </p>
                </div>
              </div>
            )}

            {/* IFC Loader - triggers model loading when IFC tab is active */}
            {isIfcActive && <EditorPane workspaceId={workspaceId} />}
          </div>

          {showTerminal && (
            <div className="relative" style={{ height: terminalHeight }}>
              <div
                onMouseDown={handleTerminalResizeStart}
                className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-20 group"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 group-hover:h-1 bg-border group-hover:bg-primary transition-colors" />
              </div>
              <div className="h-full">
                <Terminal
                  ref={terminalRef}
                  workspaceId={workspaceId}
                  onClose={onToggleTerminal}
                />
              </div>
            </div>
          )}
        </div>

        {/* Element Properties Panel - shows when element selected */}
        <ElementPropertiesPanel
          element={selectedElement?.data ?? null}
          onClose={handleClosePanel}
        />

        {/* Chat Panel */}
        {showChat && (
          <div className="relative shrink-0" style={{ width: chatWidth }}>
            <div
              onMouseDown={handleChatResizeStart}
              className="absolute top-0 left-0 bottom-0 w-2 cursor-ew-resize z-20 group"
            >
              <div className="absolute inset-y-0 left-0 w-0.5 group-hover:w-1 bg-border group-hover:bg-primary transition-colors" />
            </div>
            <ChatPanel onClose={onToggleChat} />
          </div>
        )}
      </div>
    </div>
  );
}

function Home() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const workspaceIdRef = useRef<string | null>(null);
  const terminalRef = useRef<TerminalHandle | null>(null);
  const fileBrowserRef = useRef<FileBrowserHandle | null>(null);

  const workspaceMutation = useMutation({
    ...createWorkspaceMutation(),
    onSuccess: (data) => {
      setWorkspaceId(data.id);
      workspaceIdRef.current = data.id;
    },
    onError: (error) => {
      console.error("Failed to create workspace:", error);
    },
  });

  const handleShowTerminal = useCallback(() => {
    setShowTerminal(true);
  }, []);

  useEffect(() => {
    // Create workspace for the sample project (auto-created by API on startup)
    workspaceMutation.mutate({
      body: { projectId: "sample-project" },
    });

    const cleanup = () => {
      if (workspaceIdRef.current) {
        navigator.sendBeacon(`/api/workspaces/${workspaceIdRef.current}`);
      }
    };

    window.addEventListener("pagehide", cleanup);
    window.addEventListener("beforeunload", cleanup);

    return () => {
      window.removeEventListener("pagehide", cleanup);
      window.removeEventListener("beforeunload", cleanup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!workspaceId) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
          <span className="text-muted-foreground text-sm">
            Initializing workspace...
          </span>
        </div>
      </div>
    );
  }

  const projectId = "sample-project"; // TODO: Make this dynamic based on selected project

  return (
    <EditorProvider initialFile="sample.ifc">
      <AgentProvider projectId={projectId} workspaceId={workspaceId}>
        <div className="h-screen w-screen bg-background flex overflow-hidden">
          <FileBrowser
            ref={fileBrowserRef}
            workspaceId={workspaceId}
            visible={showSidebar}
          />
          <MainContent
            workspaceId={workspaceId}
            showSidebar={showSidebar}
            showTerminal={showTerminal}
            showChat={showChat}
            terminalRef={terminalRef}
            fileBrowserRef={fileBrowserRef}
            onToggleSidebar={() => setShowSidebar(!showSidebar)}
            onToggleTerminal={() => setShowTerminal(!showTerminal)}
            onToggleChat={() => setShowChat(!showChat)}
            onShowTerminal={handleShowTerminal}
          />
        </div>
      </AgentProvider>
    </EditorProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-theme">
      <ViewerProvider
        workerUrl="/worker.mjs"
        config={{
          gridEnabled: false,
          statsEnabled: true,
        }}
      >
        <Home />
      </ViewerProvider>
    </ThemeProvider>
  );
}
