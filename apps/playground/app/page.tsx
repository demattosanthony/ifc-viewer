import { useState, useCallback, useEffect, useRef } from "react";
import {
  useViewer,
  useViewerEvents,
  Viewer,
  type ElementSelectedEvent,
} from "ifc-viewer";
import { ViewerToolBar } from "@/components/viewer-toolbar";
import { ElementPropertiesPanel } from "@/components/element-properties-panel";
import Terminal, { type TerminalHandle } from "@/components/terminal";
import { FileBrowser, type FileBrowserHandle } from "@/components/file-browser";
import { TabBar } from "@/components/tab-bar";
import { EditorPane } from "@/components/editor-pane";
import { EditorProvider, useEditor } from "@/lib/editor-context";
import { AgentProvider, useAgent } from "@/lib/agent-context";
import { ChatPanel } from "@/components/chat";
import { useResizable } from "@/hooks/use-resizable";
import { api } from "@/.bunbox/api-client";
import type { AgentEvent } from "@ifc-viewer/agent";

interface SelectedElement {
  data: Record<string, unknown>;
}

interface MainContentProps {
  sessionId: string;
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
  sessionId,
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
  const { tabs, activeTabId, openFile, setFileContent } = useEditor();
  const { onPresenceEvent } = useAgent();
  const [selectedElement, setSelectedElement] =
    useState<SelectedElement | null>(null);

  // Handle agent presence events
  useEffect(() => {
    return onPresenceEvent((event: AgentEvent) => {
      switch (event.type) {
        // Editor events
        case "editor-open":
          openFile(event.path);
          break;

        case "editor-replace":
          setFileContent(event.path, { type: "text", content: event.content });
          break;

        // Terminal events
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

        // File browser events
        case "file-created":
        case "file-deleted":
          fileBrowserRef.current?.refreshPath(event.path);
          break;
      }
    });
  }, [
    onPresenceEvent,
    openFile,
    setFileContent,
    onShowTerminal,
    terminalRef,
    fileBrowserRef,
  ]);

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
      initialSize: 350,
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
                <EditorPane sessionId={sessionId} />
              </div>
            )}

            {/* Empty state when no tabs */}
            {!activeTab && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e] text-[#858585]">
                <div className="text-center">
                  <p className="text-sm">No file open</p>
                  <p className="text-xs mt-1">
                    Select a file from the explorer
                  </p>
                </div>
              </div>
            )}

            {/* IFC Loader - triggers model loading when IFC tab is active */}
            {isIfcActive && <EditorPane sessionId={sessionId} />}
          </div>

          {showTerminal && (
            <div className="relative" style={{ height: terminalHeight }}>
              <div
                onMouseDown={handleTerminalResizeStart}
                className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-20 group"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 group-hover:h-1 bg-[#2d2d2d] group-hover:bg-[#007acc] transition-colors" />
              </div>
              <div className="h-full">
                <Terminal
                  ref={terminalRef}
                  sessionId={sessionId}
                  onClose={onToggleTerminal}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar - Element Properties Panel (only show when no chat) */}
        {!showChat && (
          <ElementPropertiesPanel
            element={selectedElement?.data ?? null}
            onClose={handleClosePanel}
          />
        )}

        {/* Chat Panel */}
        {showChat && (
          <div className="relative shrink-0" style={{ width: chatWidth }}>
            <div
              onMouseDown={handleChatResizeStart}
              className="absolute top-0 left-0 bottom-0 w-2 cursor-ew-resize z-20 group"
            >
              <div className="absolute inset-y-0 left-0 w-0.5 group-hover:w-1 bg-[#2d2d2d] group-hover:bg-[#007acc] transition-colors" />
            </div>
            <ChatPanel onClose={onToggleChat} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const sessionIdRef = useRef<string | null>(null);
  const terminalRef = useRef<TerminalHandle | null>(null);
  const fileBrowserRef = useRef<FileBrowserHandle | null>(null);

  const handleShowTerminal = useCallback(() => {
    setShowTerminal(true);
  }, []);

  useEffect(() => {
    async function createSession() {
      const session = await api.sessions.createSession();
      setSessionId(session.id);
      sessionIdRef.current = session.id;
    }

    createSession();

    const cleanup = () => {
      if (sessionIdRef.current) {
        navigator.sendBeacon(`/api/sessions/${sessionIdRef.current}`);
      }
    };

    window.addEventListener("pagehide", cleanup);
    window.addEventListener("beforeunload", cleanup);

    return () => {
      window.removeEventListener("pagehide", cleanup);
      window.removeEventListener("beforeunload", cleanup);
    };
  }, []);

  if (!sessionId) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#1e1e1e] text-[#cccccc] gap-4">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-[#858585] border-t-[#cccccc] rounded-full animate-spin" />
          <span className="text-[#858585] text-sm">
            Initializing session...
          </span>
        </div>
      </div>
    );
  }

  return (
    <EditorProvider initialFile="sample.ifc">
      <AgentProvider sessionId={sessionId}>
        <div className="h-screen w-screen bg-[#1e1e1e] flex overflow-hidden">
          <FileBrowser
            ref={fileBrowserRef}
            sessionId={sessionId}
            visible={showSidebar}
          />
          <MainContent
            sessionId={sessionId}
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
