import { useState, useCallback, useEffect, useRef } from "react";
import {
  useViewer,
  useViewerEvents,
  Viewer,
  type ElementSelectedEvent,
  type MousePosition,
} from "ifc-viewer";
import { ViewerToolBar } from "@/components/viewer-toolbar";
import { ElementPropertiesPanel } from "@/components/element-properties-panel";
import Terminal from "@/components/terminal";
import { api } from "@/.bunbox/api-client";

interface SelectedElement {
  data: Record<string, unknown>;
  position?: MousePosition;
}

export default function Home() {
  const { getElement } = useViewer();
  const [selectedElement, setSelectedElement] =
    useState<SelectedElement | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(300);
  const sessionIdRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);

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
                position: event.position,
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

  async function createSession() {
    const session = await api.sessions.createSession();
    setSessionId(session.id);
    sessionIdRef.current = session.id;
  }

  useEffect(() => {
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

  // Resize handler with proper event management
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = true;
      const startY = e.clientY;
      const startHeight = terminalHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        moveEvent.preventDefault();
        const delta = startY - moveEvent.clientY;
        const newHeight = Math.max(
          150,
          Math.min(startHeight + delta, window.innerHeight - 100)
        );
        setTerminalHeight(newHeight);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [terminalHeight]
  );

  if (!sessionId) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
          <span className="text-muted-foreground text-sm">
            Initializing session...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-secondary flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <Viewer />
        <ViewerToolBar />
        <ElementPropertiesPanel
          element={selectedElement?.data ?? null}
          position={selectedElement?.position}
          onClose={handleClosePanel}
        />
        {!showTerminal && (
          <button
            onClick={() => setShowTerminal(true)}
            className="absolute bottom-4 right-4 px-3 py-1.5 bg-secondary/80 backdrop-blur border border-border text-muted-foreground rounded-md hover:bg-accent hover:text-foreground text-xs z-10 transition-colors"
          >
            Terminal
          </button>
        )}
      </div>

      {showTerminal && (
        <div className="relative" style={{ height: terminalHeight }}>
          {/* Resize handle - positioned above the terminal */}
          <div
            onMouseDown={handleResizeStart}
            className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-20 group"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-border group-hover:bg-foreground/50 transition-colors" />
          </div>
          <div className="h-full">
            <Terminal
              sessionId={sessionId}
              onClose={() => setShowTerminal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
