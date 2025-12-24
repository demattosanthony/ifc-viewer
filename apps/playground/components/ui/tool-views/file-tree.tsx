"use client"

import { FolderOpen, File, Folder } from "lucide-react"
interface FileEntry {
  name: string
  path: string
  type: "file" | "directory"
  size?: number
}

interface FileTreeProps {
  path: string
  output?: Record<string, unknown>
  isComplete: boolean
}

function FileIcon({ type }: { type: "file" | "directory" }) {
  if (type === "directory") {
    return <Folder className="h-3.5 w-3.5 text-blue-400" />
  }
  return <File className="h-3.5 w-3.5 text-muted-foreground" />
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileTree({ path, output, isComplete }: FileTreeProps) {
  const result = output as { success?: boolean; entries?: FileEntry[] } | undefined
  const entries = result?.entries || []

  // Sort: directories first, then files, alphabetically
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })

  const dirCount = entries.filter(e => e.type === "directory").length
  const fileCount = entries.filter(e => e.type === "file").length

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-xs text-foreground">{path || "."}</span>
        </div>
        {isComplete && entries.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {dirCount > 0 && `${dirCount} folder${dirCount !== 1 ? "s" : ""}`}
            {dirCount > 0 && fileCount > 0 && ", "}
            {fileCount > 0 && `${fileCount} file${fileCount !== 1 ? "s" : ""}`}
          </span>
        )}
      </div>

      {/* File list */}
      <div className="max-h-60 overflow-auto">
        {sortedEntries.length > 0 ? (
          <div className="divide-y divide-border/30">
            {sortedEntries.map((entry) => (
              <div
                key={entry.path}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-secondary/30"
              >
                <div className="flex items-center gap-2">
                  <FileIcon type={entry.type} />
                  <span className="font-mono text-xs text-foreground">
                    {entry.name}
                  </span>
                </div>
                {entry.type === "file" && entry.size !== undefined && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatSize(entry.size)}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : isComplete ? (
          <div className="p-3 text-center text-xs text-muted-foreground">
            Empty directory
          </div>
        ) : (
          <div className="p-3 text-center text-xs text-muted-foreground">
            Loading...
          </div>
        )}
      </div>
    </div>
  )
}
