import { cn } from "@ifc-viewer/ui/lib"
import { Code, Eye } from "lucide-react"
import { useAppMode } from "@/shared/context/app-mode-context"

interface ModeSwitchProps {
  className?: string
}

export function ModeSwitch({ className }: ModeSwitchProps) {
  const { mode, setMode } = useAppMode()

  return (
    <div className={cn("inline-flex items-center rounded-md bg-muted p-0.5 gap-0.5", className)}>
      <button
        onClick={() => setMode("viewer")}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-all",
          mode === "viewer"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Eye className="size-3.5" />
        <span>Viewer</span>
      </button>
      <button
        onClick={() => setMode("editor")}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-all",
          mode === "editor"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Code className="size-3.5" />
        <span>Editor</span>
      </button>
    </div>
  )
}
