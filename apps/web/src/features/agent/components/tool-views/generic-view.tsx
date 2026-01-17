"use client"

import type { ToolViewProps } from "../../types"
import { formatValue } from "../../utils"

export function GenericToolView({ input, output, isStreaming, error }: ToolViewProps) {
  const hasInput = input && Object.keys(input).length > 0
  const hasOutput = output && Object.keys(output).length > 0

  return (
    <div className="space-y-2">
      {/* Input */}
      {hasInput && (
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Input
          </div>
          <div className="rounded-md border border-border bg-card p-2">
            <div className="space-y-1 font-mono text-xs">
              {Object.entries(input).map(([key, value]) => (
                <div key={key} className="break-all">
                  <span className="text-muted-foreground">{key}:</span>{" "}
                  <span className="text-foreground">
                    {formatValue(value)}
                    {isStreaming && (
                      <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-blue-500" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Output */}
      {hasOutput && (
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Output
          </div>
          <div className="max-h-40 overflow-auto rounded-md border border-border bg-card p-2">
            <pre className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">
              {formatValue(output)}
            </pre>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-red-400">
            Error
          </div>
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2">
            <pre className="whitespace-pre-wrap font-mono text-xs text-red-400">{error}</pre>
          </div>
        </div>
      )}

      {/* Loading */}
      {!hasInput && !hasOutput && !error && (
        <div className="py-2 text-center text-xs text-muted-foreground">Processing...</div>
      )}
    </div>
  )
}
