import { cn } from "@ifc-viewer/ui/lib"
import { Code, Eye, FileText } from "lucide-react"
import type { ViewerType } from "../utils/types"
import { getAvailableViewers } from "../utils/viewer-registry"

interface ViewerSwitcherProps {
  currentViewer: ViewerType
  defaultViewer: ViewerType
  onViewerChange: (viewer: ViewerType) => void
}

const VIEWER_OPTIONS: Partial<Record<ViewerType, { label: string; icon: typeof Code }>> = {
  code: { label: "Code", icon: Code },
  markdown: { label: "Preview", icon: Eye },
  html: { label: "Preview", icon: Eye },
  pdf: { label: "PDF", icon: FileText },
}

export function ViewerSwitcher({
  currentViewer,
  defaultViewer,
  onViewerChange,
}: ViewerSwitcherProps) {
  const availableViewers = getAvailableViewers(defaultViewer)

  // Don't show switcher if only one viewer is available
  if (availableViewers.length <= 1) return null

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {availableViewers.map((viewer) => {
        const option = VIEWER_OPTIONS[viewer]
        const Icon = option?.icon ?? Code
        const isActive = currentViewer === viewer

        return (
          <button
            key={viewer}
            type="button"
            onClick={() => onViewerChange(viewer)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            {option?.label ?? viewer}
          </button>
        )
      })}
    </div>
  )
}
