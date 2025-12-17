import { useEffect, useState } from "react";
import { useViewer, useViewerEvents } from "ifc-viewer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function ViewerToolBar() {
  const { loadModel, isInitialized, unloadAllModels, getElement } = useViewer();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

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

  return (
    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
      <div className="flex items-center gap-1 p-1.5 bg-background rounded-lg border shadow-lg">
        <Button
          onClick={() => document.getElementById("file-upload")?.click()}
          variant={"default"}
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
      </div>
    </div>
  );
}
