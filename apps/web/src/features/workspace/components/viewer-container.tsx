/**
 * Unified IFC Viewer Container
 *
 * Supports two variants:
 * - "federated": Main project viewer with models popover and AI agent control
 * - "single-file": Individual IFC file viewer (no models popover, no agent)
 */

import { Viewer, ViewerProvider } from "@ifc-viewer/viewer"
import { useAgent } from "@/features/agent/context"
import { useAgentViewerPresence } from "@/features/agent/hooks/use-agent-viewer-presence"
import { ElementPropertiesPanel } from "@/features/ifc-viewer/components/element-properties-panel"
import { ViewerToolBar } from "@/features/ifc-viewer/components/viewer-toolbar"
import { useElementSelectHandler } from "@/features/ifc-viewer/hooks/use-element-select-handler"
import { useLoadIFCModel } from "@/features/ifc-viewer/hooks/use-load-ifc-model"
import { VIEWER_CONFIG } from "./viewer-config"

interface ViewerContainerProps {
  projectId: string
  variant: "federated" | "single-file"
  visible?: boolean
  /** File path to auto-load (required for single-file variant) */
  filePath?: string
}

interface ViewerContentProps {
  projectId: string
  variant: "federated" | "single-file"
  filePath?: string
}

function ViewerContent({ projectId, variant, filePath }: ViewerContentProps) {
  const { selectedElements, clearSelection, handleElementSelect } = useElementSelectHandler()
  const { conversationId } = useAgent()

  const isFederated = variant === "federated"

  // Only enable agent viewer control for the main federated viewer
  useAgentViewerPresence({
    projectId,
    conversationId: isFederated ? conversationId : null,
  })

  // Auto-load IFC file for single-file variant
  const { error: loadError } = useLoadIFCModel({
    projectId,
    filePath: filePath ?? "",
    enabled: !isFederated && !!filePath,
  })

  return (
    <>
      <Viewer />
      <ViewerToolBar
        projectId={isFederated ? projectId : undefined}
        showModelsPopover={isFederated}
        onElementSelect={handleElementSelect}
      />
      <ElementPropertiesPanel elements={selectedElements} onClose={clearSelection} />
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm max-w-md text-center">
            {loadError}
          </div>
        </div>
      )}
    </>
  )
}

export function ViewerContainer({
  projectId,
  variant,
  visible = true,
  filePath,
}: ViewerContainerProps) {
  // Federated viewer stays mounted (visibility toggled), single-file unmounts
  const visibilityClass = variant === "federated" ? (visible ? "visible" : "invisible") : ""

  return (
    <div className={`absolute inset-0 ${visibilityClass}`}>
      <ViewerProvider config={VIEWER_CONFIG}>
        <ViewerContent projectId={projectId} variant={variant} filePath={filePath} />
      </ViewerProvider>
    </div>
  )
}
