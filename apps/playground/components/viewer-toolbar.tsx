import { useEffect, useState } from "react";
import { useViewer, useViewerEvents, type CameraMode } from "ifc-viewer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HandGrab,
  Rotate3D,
  PersonStanding,
  LayoutDashboard,
} from "lucide-react";

const CAMERA_MODES = [
  { mode: "Orbit" as CameraMode, label: "Orbit", icon: Rotate3D },
  { mode: "Plan" as CameraMode, label: "Grab", icon: HandGrab },
  {
    mode: "FirstPerson" as CameraMode,
    label: "First Person",
    icon: PersonStanding,
  },
] as const;

export function ViewerToolBar() {
  const {
    loadModel,
    isInitialized,
    unloadAllModels,
    getElement,
    camera,
    planViews,
  } = useViewer();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cameraModeOpen, setCameraModeOpen] = useState(false);
  const [planViewsOpen, setPlanViewsOpen] = useState(false);

  const currentModeConfig = CAMERA_MODES.find((m) => m.mode === camera?.mode);
  const CurrentIcon = currentModeConfig?.icon ?? Rotate3D;

  useViewerEvents({
    onElementSelected: (event) => {
      console.log("on element selected", event);

      Object.entries(event.modelIdMap).forEach(([modelId, localIdSet]) => {
        localIdSet.forEach(async (localId) => {
          const element = await getElement(modelId, localId);
          console.log("element", element);
        });
      });
    },
  });

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    await unloadAllModels();
    const buffer = await file.arrayBuffer();
    await loadModel(buffer, file.name, (progress) => {
      setProgress(progress);
    });
    setUploading(false);
  };

  useEffect(() => {
    const loadSampleModel = async () => {
      const sampleIfc = "/sample.ifc";
      try {
        const response = await fetch(sampleIfc);
        const blob = await response.blob();
        const file = new File([blob], "sample.ifc", {
          type: "application/ifc",
        });
        const buffer = await file.arrayBuffer();
        loadModel(buffer, file.name);
      } catch (error) {
        console.error("Error loading sample model:", error);
      }
    };

    if (isInitialized) {
      loadSampleModel();
    }
  }, [isInitialized]);

  if (uploading) {
    return (
      <div className="absolute top-0 left-0 w-full h-full z-100 flex items-center justify-center bg-background">
        <div className="w-full max-w-md flex flex-col items-center justify-center gap-2">
          <Progress value={progress * 100} />
          <p className="text-sm text-center mt-1"> Loading IFC model... </p>
        </div>
      </div>
    );
  }

  const handleModeChange = (mode: CameraMode) => {
    camera?.setMode(mode);
    setCameraModeOpen(false);
  };

  const handlePlanSelect = (planId: string) => {
    if (planViews?.activePlanId === planId) {
      planViews?.close();
    } else {
      planViews?.open(planId);
    }
  };

  return (
    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
      <div className="flex items-center gap-1 p-1.5 bg-background rounded-lg border shadow-lg">
        <Button
          onClick={() => document.getElementById("file-upload")?.click()}
          variant="default"
          disabled={uploading}
        >
          Upload your own ifc model
        </Button>
        <input
          id="file-upload"
          type="file"
          accept=".ifc"
          onChange={handleFileChange}
          className="hidden"
        />

        <Popover open={cameraModeOpen} onOpenChange={setCameraModeOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" title="Camera Mode">
              <CurrentIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start" side="top">
            <div className="flex flex-col gap-0.5">
              {CAMERA_MODES.map(({ mode, label, icon: Icon }) => (
                <Button
                  key={mode}
                  variant={camera?.mode === mode ? "secondary" : "ghost"}
                  size="sm"
                  className="justify-start gap-2 font-light"
                  onClick={() => handleModeChange(mode)}
                >
                  <Icon className="size-4" />
                  {label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {planViews && planViews.plans.length > 0 && (
          <Popover open={planViewsOpen} onOpenChange={setPlanViewsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={planViews.activePlanId ? "secondary" : "ghost"}
                size="icon"
                title="Floor Plans"
              >
                <LayoutDashboard className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="start" side="top">
              <div className="flex flex-col gap-0.5">
                {planViews.plans.map((plan) => (
                  <Button
                    key={plan.id}
                    variant={
                      planViews.activePlanId === plan.id ? "secondary" : "ghost"
                    }
                    className="justify-start gap-2 font-light"
                    onClick={() => handlePlanSelect(plan.id)}
                  >
                    {plan.name}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
