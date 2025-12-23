import { useState, useCallback, useEffect, useRef } from "react";
import {
  useViewer,
  useViewerEvents,
  Viewer,
  type ElementSelectedEvent,
} from "ifc-viewer";
import { ViewerToolBar } from "@/components/viewer-toolbar";
import { ElementPropertiesPanel } from "@/components/element-properties-panel";
import Terminal from "@/components/terminal";
import { FileBrowser } from "@/components/file-browser";
import { TabBar } from "@/components/tab-bar";
import { EditorPane } from "@/components/editor-pane";
import { EditorProvider, useEditor } from "@/lib/editor-context";
import { useResizable } from "@/hooks/use-resizable";
import { api } from "@/.bunbox/api-client";

interface SelectedElement {
  data: Record<string, unknown>;
}

interface MainContentProps {
  sessionId: string;
  showSidebar: boolean;
  showTerminal: boolean;
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
}

function MainContent({
  sessionId,
  showSidebar,
  showTerminal,
  onToggleSidebar,
  onToggleTerminal,
}: MainContentProps) {
  const { getElement } = useViewer();
  const { tabs, activeTabId } = useEditor();
  const [selectedElement, setSelectedElement] =
    useState<SelectedElement | null>(null);

  const { size: terminalHeight, handleResizeStart } = useResizable({
    initialSize: 300,
    minSize: 150,
    maxSize: typeof window !== "undefined" ? window.innerHeight - 200 : 600,
    direction: "vertical",
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
        onToggleSidebar={onToggleSidebar}
        onToggleTerminal={onToggleTerminal}
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
                onMouseDown={handleResizeStart}
                className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-20 group"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 group-hover:h-1 bg-[#2d2d2d] group-hover:bg-[#007acc] transition-colors" />
              </div>
              <div className="h-full">
                <Terminal sessionId={sessionId} onClose={onToggleTerminal} />
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar - Element Properties Panel */}
        <ElementPropertiesPanel
          element={selectedElement?.data ?? null}
          onClose={handleClosePanel}
        />
      </div>
    </div>
  );
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const sessionIdRef = useRef<string | null>(null);

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
      <div className="h-screen w-screen bg-[#1e1e1e] flex overflow-hidden">
        <FileBrowser sessionId={sessionId} visible={showSidebar} />
        <MainContent
          sessionId={sessionId}
          showSidebar={showSidebar}
          showTerminal={showTerminal}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
          onToggleTerminal={() => setShowTerminal(!showTerminal)}
        />
      </div>
    </EditorProvider>
  );
}
