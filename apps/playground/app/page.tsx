import { useViewer, useViewerEvents, Viewer } from "ifc-viewer";
import { ViewerToolBar } from "@/components/viewer-toolbar";

export default function Home() {
  const { getElement } = useViewer();

  // Event handlers for element selection
  useViewerEvents({
    onElementSelected: async (event) => {
      for (const [modelId, localIdSet] of Object.entries(event.modelIdMap)) {
        for (const localId of localIdSet) {
          const element = await getElement(modelId, localId);
          console.log("Selected element:", element);
        }
      }
    },
  });

  return (
    <div className="h-screen w-screen bg-secondary">
      <Viewer />
      <ViewerToolBar />
    </div>
  );
}
