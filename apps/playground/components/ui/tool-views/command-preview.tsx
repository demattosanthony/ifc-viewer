"use client"

import { useState, useCallback } from "react"
import { Terminal, Copy, Check, CheckCircle2, XCircle } from "lucide-react"
interface CommandPreviewProps {
  command: string
  output?: Record<string, unknown>
  isStreaming: boolean
  isComplete: boolean
  error?: string
}

export function CommandPreview({
  command,
  output,
  isStreaming,
  isComplete,
  error,
}: CommandPreviewProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [command])

  // Extract output details
  const result = output as { success?: boolean; output?: string; exitCode?: number } | undefined
  const hasOutput = result?.output && result.output.trim().length > 0

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-xs text-foreground">Terminal</span>
          {isComplete && result && (
            <span className="flex items-center gap-1">
              {result.success ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500" />
              )}
              {result.exitCode !== undefined && (
                <span className="text-[10px] text-muted-foreground">
                  exit {result.exitCode}
                </span>
              )}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Copy command"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Command */}
      <div className="border-b border-border/50 p-3">
        <div className="flex items-start gap-2 font-mono text-sm">
          <span className="select-none text-green-500">$</span>
          <span className="text-foreground/90">
            {command}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-blue-500" />
            )}
          </span>
        </div>
      </div>

      {/* Output */}
      {hasOutput && (
        <div className="max-h-40 overflow-auto p-3">
          <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
            {result.output}
          </pre>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-t border-border/50 bg-red-500/5 p-3">
          <pre className="whitespace-pre-wrap font-mono text-xs text-red-400">
            {error}
          </pre>
        </div>
      )}
    </div>
  )
}
