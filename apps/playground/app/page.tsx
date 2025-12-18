import { useState, useCallback } from "react";
import {
  useViewer,
  useViewerEvents,
  Viewer,
  type ElementSelectedEvent,
  type MousePosition,
} from "ifc-viewer";
import { ViewerToolBar } from "@/components/viewer-toolbar";
import { ElementPropertiesPanel } from "@/components/element-properties-panel";

interface SelectedElement {
  data: Record<string, unknown>;
  position?: MousePosition;
}

export default function Home() {
  const { getElement } = useViewer();
  const [selectedElement, setSelectedElement] =
    useState<SelectedElement | null>(null);

  // Event handlers for element selection
  useViewerEvents({
    onElementSelected: useCallback(
      async (event: ElementSelectedEvent) => {
        const entries = Object.entries(event.modelIdMap);

        // If no selection, clear the panel
        if (entries.length === 0) {
          setSelectedElement(null);
          return;
        }

        // Get the first selected element
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

  return (
    <div className="h-screen w-screen bg-secondary">
      <Viewer />
      <ViewerToolBar />
      <ElementPropertiesPanel
        element={selectedElement?.data ?? null}
        position={selectedElement?.position}
        onClose={handleClosePanel}
      />
    </div>
  );
}
