"use client"

import { CodeBlockCode } from "@ifc-viewer/ui/components"
import { Check, Copy, File } from "lucide-react"
import { useMemo } from "react"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { getFileName, getLanguageFromPath } from "./types"

interface FilePreviewProps {
  path: string
  content: string
  isStreaming: boolean
}

export function FilePreview({ path, content, isStreaming }: FilePreviewProps) {
  const { copied, copy } = useCopyToClipboard()
  const language = useMemo(() => getLanguageFromPath(path), [path])
  const fileName = useMemo(() => getFileName(path), [path])

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/40 dark:bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <File className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-xs text-foreground">{fileName}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {language}
          </span>
        </div>
        <button
          onClick={() => copy(content)}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {/* Code */}
      <div className="max-h-80 overflow-auto">
        <CodeBlockCode code={content} language={language} className="text-[13px]" />
        {isStreaming && (
          <span className="inline-block h-4 w-0.5 animate-pulse bg-blue-500 ml-3 mb-3" />
        )}
      </div>
    </div>
  )
}
