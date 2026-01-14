import { Viewer, ViewerProvider } from "@ifc-viewer/viewer"
import { EditorPane } from "@/features/editor/components/editor-pane"
import { ElementPropertiesPanel } from "@/features/ifc-viewer/components/element-properties-panel"
import { ViewerToolBar } from "@/features/ifc-viewer/components/viewer-toolbar"
import { useElementSelectHandler } from "@/features/ifc-viewer/hooks/use-element-select-handler"
import { VIEWER_CONFIG } from "./viewer-config"

interface SingleFileViewerContentProps {
  projectId: string
}

function SingleFileViewerContent({ projectId }: SingleFileViewerContentProps) {
  const { selectedElement, clearSelection, handleElementSelect } = useElementSelectHandler()

  return (
    <>
      <Viewer />
      <ViewerToolBar showModelsPopover={false} onElementSelect={handleElementSelect} />
      <ElementPropertiesPanel element={selectedElement?.data ?? null} onClose={clearSelection} />
      <EditorPane projectId={projectId} />
    </>
  )
}

interface SingleFileViewerProps {
  projectId: string
}

export function SingleFileViewer({ projectId }: SingleFileViewerProps) {
  return (
    <div className="absolute inset-0">
      <ViewerProvider config={VIEWER_CONFIG}>
        <SingleFileViewerContent projectId={projectId} />
      </ViewerProvider>
    </div>
  )
}
