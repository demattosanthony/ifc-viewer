import { Toaster } from "@ifc-viewer/ui/components"
import { ViewerProvider } from "@ifc-viewer/viewer"
import { AgentProvider } from "@/features/agent/context"
import { EditorProvider } from "@/features/editor/context"
import { EditorModeLayout } from "@/features/editor-mode"
import { ViewerModeLayout } from "@/features/viewer-mode"
import { ThemeProvider } from "./shared/components/theme-provider"
import { AppModeProvider, useAppMode } from "./shared/context/app-mode-context"

const PROJECT_ID = "sample-project"

function AppContent() {
  const { mode } = useAppMode()
  const projectId = PROJECT_ID

  return (
    <AgentProvider projectId={projectId}>
      <div className="h-screen w-screen bg-background flex overflow-hidden">
        {mode === "viewer" ? (
          <ViewerProvider
            key="viewer-mode"
            config={{
              gridEnabled: false,
              statsEnabled: true,
              backgroundColor: "#1e1e1e",
            }}
          >
            <ViewerModeLayout projectId={projectId} />
          </ViewerProvider>
        ) : (
          <ViewerProvider
            key="editor-mode"
            config={{
              gridEnabled: false,
              statsEnabled: true,
              backgroundColor: "#1e1e1e",
            }}
          >
            <EditorProvider initialFile="models/sample.ifc">
              <EditorModeLayout projectId={projectId} />
            </EditorProvider>
          </ViewerProvider>
        )}
      </div>
    </AgentProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppModeProvider>
        <AppContent />
      </AppModeProvider>
      <Toaster position="bottom-right" />
    </ThemeProvider>
  )
}
