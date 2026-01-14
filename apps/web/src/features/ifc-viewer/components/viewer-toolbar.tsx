import { Button, Popover, PopoverContent, PopoverTrigger } from "@ifc-viewer/ui/components"
import { type CameraMode, useViewer } from "@ifc-viewer/viewer"
import { Check, HandGrab, Layers, PersonStanding, Rotate3D, X } from "lucide-react"
import { useState } from "react"
import { HierarchyPopover } from "./hierarchy-popover"
import { ModelsPopover } from "./models-popover"

// ============================================================================
// Constants
// ============================================================================

const CAMERA_MODES = [
  { mode: "Orbit" as CameraMode, label: "Orbit", icon: Rotate3D },
  { mode: "Plan" as CameraMode, label: "Pan", icon: HandGrab },
  { mode: "FirstPerson" as CameraMode, label: "Walk", icon: PersonStanding },
] as const

// ============================================================================
// Camera Mode Selector
// ============================================================================

interface CameraModeSelectorProps {
  currentMode: CameraMode | undefined
  onModeChange: (mode: CameraMode) => void
}

function CameraModeSelector({ currentMode, onModeChange }: CameraModeSelectorProps) {
  const [open, setOpen] = useState(false)

  const currentConfig = CAMERA_MODES.find((m) => m.mode === currentMode)
  const CurrentIcon = currentConfig?.icon ?? Rotate3D

  const handleSelect = (mode: CameraMode) => {
    onModeChange(mode)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title={`Camera: ${currentConfig?.label ?? "Orbit"}`}>
          <CurrentIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="center" side="top" sideOffset={8}>
        <div className="flex flex-col">
          {CAMERA_MODES.map(({ mode, label, icon: Icon }) => (
            <Button
              key={mode}
              variant={currentMode === mode ? "secondary" : "ghost"}
              size="sm"
              className="justify-start gap-2 font-normal"
              onClick={() => handleSelect(mode)}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ============================================================================
// Plan View Selector
// ============================================================================

interface Plan {
  id: string
  name: string
}

interface PlanViewSelectorProps {
  plans: Plan[]
  activePlanId: string | null
  onPlanSelect: (planId: string) => void
}

function PlanViewSelector({ plans, activePlanId, onPlanSelect }: PlanViewSelectorProps) {
  const [open, setOpen] = useState(false)

  if (plans.length === 0) return null

  const handleSelect = (planId: string) => {
    onPlanSelect(planId)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={activePlanId ? "secondary" : "ghost"}
          size="icon"
          title="Floor Plans"
          className="relative"
        >
          <Layers className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 overflow-hidden" align="center" side="top" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Floor Plans</span>
          </div>
          {activePlanId && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onPlanSelect(activePlanId)}
              title="Exit floor plan view"
              className="size-6"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Floor Plans List */}
        <div className="py-1.5 max-h-64 overflow-y-auto">
          {plans.map((plan, index) => {
            const isActive = activePlanId === plan.id
            return (
              <Button
                key={plan.id}
                variant={isActive ? "secondary" : "ghost"}
                onClick={() => handleSelect(plan.id)}
                className="w-full justify-start gap-3 px-3 py-2 h-auto rounded-none font-normal"
              >
                {/* Floor Level Indicator */}
                <div
                  className={`
                  flex items-center justify-center size-7 rounded-md text-xs font-medium
                  transition-colors duration-150
                  ${isActive ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}
                `}
                >
                  {index + 1}
                </div>

                {/* Plan Name */}
                <span className="flex-1 text-sm truncate text-left">{plan.name}</span>

                {/* Active Check */}
                {isActive && <Check className="size-4 shrink-0" />}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ============================================================================
// Toolbar Container
// ============================================================================

interface ToolbarContainerProps {
  children: React.ReactNode
}

function ToolbarContainer({ children }: ToolbarContainerProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-background rounded-xl border border-border/50 shadow-lg">
        {children}
      </div>
    </div>
  )
}

// ============================================================================
// Divider
// ============================================================================

function ToolbarDivider() {
  return <div className="w-px h-6 bg-border/50 mx-1" />
}

// ============================================================================
// Main ViewerToolBar Component
// ============================================================================

interface ViewerToolBarProps {
  projectId?: string
  onElementSelect?: (modelId: string, localId: number) => void
  /** Show the models popover for loading/unloading models. Default: true */
  showModelsPopover?: boolean
  /** Show the hierarchy popover for spatial navigation. Default: true */
  showHierarchy?: boolean
}

export function ViewerToolBar({
  projectId,
  onElementSelect,
  showModelsPopover = true,
  showHierarchy = true,
}: ViewerToolBarProps) {
  const { camera, planViews } = useViewer()

  // Camera mode handler
  const handleCameraModeChange = (mode: CameraMode) => {
    camera?.setMode(mode)
  }

  // Plan view handler
  const handlePlanSelect = (planId: string) => {
    if (planViews?.activePlanId === planId) {
      planViews.close()
    } else {
      planViews?.open(planId)
    }
  }

  const showModelSection = (showModelsPopover && projectId) || (showHierarchy && onElementSelect)

  return (
    <ToolbarContainer>
      {showModelSection && (
        <>
          {showModelsPopover && projectId && <ModelsPopover projectId={projectId} />}
          {showHierarchy && onElementSelect && (
            <HierarchyPopover onElementSelect={onElementSelect} />
          )}
          <ToolbarDivider />
        </>
      )}
      <CameraModeSelector currentMode={camera?.mode} onModeChange={handleCameraModeChange} />

      {planViews && planViews.plans.length > 0 && (
        <>
          <ToolbarDivider />
          <PlanViewSelector
            plans={planViews.plans}
            activePlanId={planViews.activePlanId}
            onPlanSelect={handlePlanSelect}
          />
        </>
      )}
    </ToolbarContainer>
  )
}
