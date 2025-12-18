import { Viewer, ViewerProvider } from "ifc-viewer";
import { ViewerToolBar } from "@/components/viewer-toolbar";

export default function Home() {
  return (
    <ViewerProvider
      workerUrl="/worker.mjs"
      config={{
        gridEnabled: false,
        statsEnabled: true,
      }}
    >
      <div className="h-screen w-screen bg-secondary">
        <Viewer />
        <ViewerToolBar />
      </div>
    </ViewerProvider>
  );
}
