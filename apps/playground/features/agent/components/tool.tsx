"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible"
import { cn } from "@/shared/utils/cn"
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  XCircle,
  Terminal,
} from "lucide-react"
import { useState } from "react"
import { GenericToolView } from "./tool-views/generic-view"

export type ToolPart = {
  type: string
  state:
    | "streaming"
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error"
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  toolCallId?: string
  errorText?: string
}

export type ToolProps = {
  toolPart: ToolPart
  defaultOpen?: boolean
  className?: string
}

// Get a friendly display name for the tool
function getToolDisplayName(type: string): string {
  return type.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim()
}

/**
 * Generic Tool component - used as a fallback for tools without specialized UI.
 * Specialized tools (writeFile, executeCommand, listFiles) should use their
 * dedicated components directly (FilePreview, CommandPreview, FileTree).
 */
const Tool = ({ toolPart, defaultOpen = false, className }: ToolProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const { state, input, output } = toolPart

  const isLoading = state === "streaming" || state === "input-streaming" || state === "input-available"
  const isStreaming = state === "streaming"
  const isError = state === "output-error"
  const isSuccess = state === "output-available"

  const summary = input ? Object.values(input)[0] : undefined
  const summaryText = typeof summary === "string" ? summary : ""

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
          isError && "bg-red-500/10 hover:bg-red-500/20",
          className
        )}
      >
        {/* Status icon */}
        <div className="flex-shrink-0">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
          ) : isError ? (
            <XCircle className="h-3.5 w-3.5 text-red-500" />
          ) : isSuccess ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Terminal className="h-3.5 w-3.5" />
          )}
        </div>

        {/* Tool name and summary */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-medium text-foreground">
            {getToolDisplayName(toolPart.type)}
          </span>
          {summaryText && (
            <span className="truncate font-mono text-xs text-muted-foreground">
              {summaryText}
            </span>
          )}
        </div>

        {/* Expand icon */}
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-90"
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 rounded-lg bg-secondary/30 p-3">
          <GenericToolView
            input={input}
            output={output}
            isStreaming={isStreaming}
            error={isError ? toolPart.errorText : undefined}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { Tool }
