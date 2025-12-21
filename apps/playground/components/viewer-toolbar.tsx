import { useEffect, useState, useRef } from "react";
import { useViewer, type CameraMode } from "ifc-viewer";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HandGrab,
  Rotate3D,
  PersonStanding,
  Upload,
  Layers,
  Check,
  X,
} from "lucide-react";

// ============================================================================
// Constants
// ============================================================================

const CAMERA_MODES = [
  { mode: "Orbit" as CameraMode, label: "Orbit", icon: Rotate3D },
  { mode: "Plan" as CameraMode, label: "Pan", icon: HandGrab },
  { mode: "FirstPerson" as CameraMode, label: "Walk", icon: PersonStanding },
] as const;

// ============================================================================
// Loading Overlay - Apple-inspired minimal design
// ============================================================================

interface LoadingOverlayProps {
  progress: number;
}

function LoadingOverlay({ progress }: LoadingOverlayProps) {
  const percentage = Math.round(progress * 100);
  const circumference = 2 * Math.PI * 20;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-950">
      <div className="flex flex-col items-center gap-6">
        {/* Circular progress indicator */}
        <div className="relative w-14 h-14">
          {/* Background ring */}
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 44 44">
            <circle
              cx="22"
              cy="22"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-neutral-800"
            />
            <circle
              cx="22"
              cy="22"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-white transition-all duration-300 ease-out"
              style={{
                strokeDasharray: circumference,
                strokeDashoffset: strokeDashoffset,
              }}
            />
          </svg>
          {/* Percentage in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-light text-neutral-400 tabular-nums">
              {percentage}
            </span>
          </div>
        </div>

        {/* Status text */}
        <p className="text-sm font-light text-neutral-500 tracking-wide">
          Loading
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// File Upload Button
// ============================================================================

interface FileUploadButtonProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

function FileUploadButton({ onFileSelect, disabled }: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // Reset input so the same file can be selected again
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <Button
        onClick={() => inputRef.current?.click()}
        variant="ghost"
        size="sm"
        disabled={disabled}
        className="gap-2"
      >
        <Upload className="size-4" />
        <span className="hidden sm:inline">Upload IFC</span>
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".ifc"
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
      />
    </>
  );
}

// ============================================================================
// Camera Mode Selector
// ============================================================================

interface CameraModeSelectorProps {
  currentMode: CameraMode | undefined;
  onModeChange: (mode: CameraMode) => void;
}

function CameraModeSelector({
  currentMode,
  onModeChange,
}: CameraModeSelectorProps) {
  const [open, setOpen] = useState(false);

  const currentConfig = CAMERA_MODES.find((m) => m.mode === currentMode);
  const CurrentIcon = currentConfig?.icon ?? Rotate3D;

  const handleSelect = (mode: CameraMode) => {
    onModeChange(mode);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={`Camera: ${currentConfig?.label ?? "Orbit"}`}
        >
          <CurrentIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-36 p-1"
        align="center"
        side="top"
        sideOffset={8}
      >
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
  );
}

// ============================================================================
// Plan View Selector
// ============================================================================

interface Plan {
  id: string;
  name: string;
}

interface PlanViewSelectorProps {
  plans: Plan[];
  activePlanId: string | null;
  onPlanSelect: (planId: string) => void;
}

function PlanViewSelector({
  plans,
  activePlanId,
  onPlanSelect,
}: PlanViewSelectorProps) {
  const [open, setOpen] = useState(false);

  if (plans.length === 0) return null;

  const handleSelect = (planId: string) => {
    onPlanSelect(planId);
  };

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
      <PopoverContent
        className="w-56 p-0 overflow-hidden"
        align="center"
        side="top"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Floor Plans</span>
          </div>
          {activePlanId && (
            <button
              onClick={() => onPlanSelect(activePlanId)}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              title="Exit floor plan view"
            >
              <X className="size-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Floor Plans List */}
        <div className="py-1.5 max-h-64 overflow-y-auto">
          {plans.map((plan, index) => {
            const isActive = activePlanId === plan.id;
            return (
              <button
                key={plan.id}
                onClick={() => handleSelect(plan.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 text-left
                  transition-all duration-150 ease-out
                  ${
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "hover:bg-muted/50 text-foreground"
                  }
                `}
              >
                {/* Floor Level Indicator */}
                <div
                  className={`
                  flex items-center justify-center size-7 rounded-md text-xs font-medium
                  transition-colors duration-150
                  ${
                    isActive
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  }
                `}
                >
                  {index + 1}
                </div>

                {/* Plan Name */}
                <span className="flex-1 text-sm truncate">{plan.name}</span>

                {/* Active Check */}
                {isActive && (
                  <Check className="size-4 text-foreground shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Toolbar Container
// ============================================================================

interface ToolbarContainerProps {
  children: React.ReactNode;
}

function ToolbarContainer({ children }: ToolbarContainerProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-background/80 backdrop-blur-lg rounded-xl border border-border/50 shadow-lg">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Divider
// ============================================================================

function ToolbarDivider() {
  return <div className="w-px h-6 bg-border/50 mx-1" />;
}

// ============================================================================
// Main ViewerToolBar Component
// ============================================================================

export function ViewerToolBar() {
  const { loadModel, isInitialized, unloadAllModels, camera, planViews } =
    useViewer();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);


  // File upload handler
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setProgress(0);

    try {
      await unloadAllModels();
      const buffer = await file.arrayBuffer();
      await loadModel(buffer, file.name, setProgress);
    } catch (error) {
      console.error("Failed to load model:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Camera mode handler
  const handleCameraModeChange = (mode: CameraMode) => {
    camera?.setMode(mode);
  };

  // Plan view handler
  const handlePlanSelect = (planId: string) => {
    if (planViews?.activePlanId === planId) {
      planViews.close();
    } else {
      planViews?.open(planId);
    }
  };

  // Show loading overlay
  if (isLoading) {
    return <LoadingOverlay progress={progress} />;
  }

  return (
    <ToolbarContainer>
      <FileUploadButton onFileSelect={handleFileUpload} disabled={isLoading} />

      <ToolbarDivider />

      <CameraModeSelector
        currentMode={camera?.mode}
        onModeChange={handleCameraModeChange}
      />

      {planViews && planViews.plans.length > 0 && (
        <PlanViewSelector
          plans={planViews.plans}
          activePlanId={planViews.activePlanId}
          onPlanSelect={handlePlanSelect}
        />
      )}
    </ToolbarContainer>
  );
}
