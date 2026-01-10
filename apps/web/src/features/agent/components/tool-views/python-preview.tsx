"use client"

import {
  CodeBlockCode,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ifc-viewer/ui/components"
import { cn } from "@ifc-viewer/ui/lib"
import { Check, CheckCircle2, ChevronDown, Copy, Loader2, XCircle } from "lucide-react"
import { useState } from "react"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"

interface PythonPreviewProps {
  title?: string
  code: string
  output?: Record<string, unknown>
  isStreaming: boolean
  isComplete: boolean
  error?: string
}

export function PythonPreview({
  title,
  code,
  output,
  isStreaming,
  isComplete,
  error,
}: PythonPreviewProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { copied: codeCopied, copy: copyCode } = useCopyToClipboard()
  const { copied: outputCopied, copy: copyOutput } = useCopyToClipboard()

  // Extract output details
  const result = output as
    | { success?: boolean; output?: string; error?: string; filesChanged?: number }
    | undefined

  const outputText = result?.output || ""
  const hasOutput = outputText.length > 0

  // Status
  const isSuccess = isComplete && result?.success !== false && !error
  const isError = isComplete && (result?.success === false || !!error)
  const isRunning = !isComplete || isStreaming

  // Display title - use provided title or "Ran code"
  const displayTitle = title || "Ran code"

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "overflow-hidden rounded-lg border transition-colors",
          isError ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"
        )}
      >
        {/* Minimal header */}
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-left transition-colors",
              "hover:bg-secondary/50",
              isOpen && "border-b border-border"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Status Icon */}
              {isRunning ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
              ) : isSuccess ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-500" />
              )}

              {/* Title only */}
              <span className="text-sm text-foreground truncate">{displayTitle}</span>
            </div>

            {/* Expand indicator */}
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>

        {/* Expandable content */}
        <CollapsibleContent>
          <div>
            {/* Code section - subtle header with copy button */}
            <div className="relative">
              <div className="absolute right-2 top-2 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    copyCode(code)
                  }}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title="Copy code"
                >
                  {codeCopied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <div className="max-h-64 overflow-auto">
                <CodeBlockCode code={code} language="python" className="text-[13px]" />
                {isStreaming && (
                  <span className="inline-block h-4 w-0.5 animate-pulse bg-blue-500 ml-3 mb-3" />
                )}
              </div>
            </div>

            {/* Output section - visually distinct */}
            {(hasOutput || isRunning || error || result?.error) && (
              <div className="border-t border-border bg-secondary/20">
                {/* Output content */}
                {hasOutput && (
                  <div className="relative">
                    <div className="absolute right-2 top-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          copyOutput(outputText)
                        }}
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title="Copy output"
                      >
                        {outputCopied ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="max-h-48 overflow-auto p-3 pr-10">
                      <pre className="whitespace-pre-wrap font-mono text-xs text-foreground leading-relaxed">
                        {outputText}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Running state */}
                {isRunning && !hasOutput && (
                  <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Running...
                  </div>
                )}

                {/* Error display */}
                {(error || result?.error) && (
                  <div className="border-t border-red-500/20 bg-red-500/5 p-3">
                    <pre className="whitespace-pre-wrap font-mono text-xs text-red-400">
                      {error || result?.error}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
