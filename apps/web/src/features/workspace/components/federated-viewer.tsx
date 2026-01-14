import { Viewer, ViewerProvider } from "@ifc-viewer/viewer"
import { ElementPropertiesPanel } from "@/features/ifc-viewer/components/element-properties-panel"
import { ViewerToolBar } from "@/features/ifc-viewer/components/viewer-toolbar"
import { useElementSelectHandler } from "@/features/ifc-viewer/hooks/use-element-select-handler"
import { VIEWER_CONFIG } from "./viewer-config"

interface FederatedViewerContentProps {
  projectId: string
}

function FederatedViewerContent({ projectId }: FederatedViewerContentProps) {
  const { selectedElement, clearSelection, handleElementSelect } = useElementSelectHandler()

  return (
    <>
      <Viewer />
      <ViewerToolBar projectId={projectId} onElementSelect={handleElementSelect} />
      <ElementPropertiesPanel element={selectedElement?.data ?? null} onClose={clearSelection} />
    </>
  )
}

interface FederatedViewerProps {
  projectId: string
  visible: boolean
}

export function FederatedViewer({ projectId, visible }: FederatedViewerProps) {
  return (
    <div className={`absolute inset-0 ${visible ? "visible" : "invisible"}`}>
      <ViewerProvider config={VIEWER_CONFIG}>
        <FederatedViewerContent projectId={projectId} />
      </ViewerProvider>
    </div>
  )
}
