import { FileQuestion } from "lucide-react"

export interface UnsupportedViewerProps {
  filename: string
}

export function UnsupportedViewer({ filename }: UnsupportedViewerProps) {
  const ext = filename.split(".").pop()?.toLowerCase() || "unknown"

  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center bg-background text-muted-foreground gap-4">
      <FileQuestion className="h-16 w-16 text-muted-foreground/50" />
      <div className="text-center">
        <p className="text-sm font-medium">No preview available</p>
        <p className="text-xs mt-1">
          Files with <code className="bg-muted px-1 py-0.5 rounded">.{ext}</code> extension cannot
          be previewed
        </p>
      </div>
    </div>
  )
}
