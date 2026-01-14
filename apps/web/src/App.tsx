import { Toaster } from "@ifc-viewer/ui/components"
import { AgentProvider } from "@/features/agent/context"
import { EditorProvider } from "@/features/editor/context"
import { WorkspaceLayout } from "@/features/workspace"
import { ThemeProvider } from "./shared/components/theme-provider"

const PROJECT_ID = "sample-project"

function AppContent() {
  const projectId = PROJECT_ID

  return (
    <AgentProvider projectId={projectId}>
      <div className="h-screen w-screen bg-background flex overflow-hidden">
        <EditorProvider>
          <WorkspaceLayout projectId={projectId} />
        </EditorProvider>
      </div>
    </AgentProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
      <Toaster position="bottom-right" />
    </ThemeProvider>
  )
}
