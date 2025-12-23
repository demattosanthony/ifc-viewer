"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  XCircle,
  Terminal,
  FileText,
  FolderOpen,
  Pencil,
} from "lucide-react"
import { useState } from "react"

export type ToolPart = {
  type: string
  state:
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
  const names: Record<string, string> = {
    shell_execute: "Run command",
    read_file: "Read file",
    write_file: "Write file",
    list_directory: "List directory",
    create_directory: "Create directory",
    delete_file: "Delete file",
  }
  return names[type] || type.replace(/_/g, " ")
}

// Get icon for tool type
function getToolIcon(type: string) {
  const iconClass = "h-3.5 w-3.5"
  switch (type) {
    case "shell_execute":
      return <Terminal className={iconClass} />
    case "read_file":
      return <FileText className={iconClass} />
    case "write_file":
      return <Pencil className={iconClass} />
    case "list_directory":
    case "create_directory":
      return <FolderOpen className={iconClass} />
    default:
      return <Terminal className={iconClass} />
  }
}

// Get a summary of the tool input
function getToolSummary(type: string, input?: Record<string, unknown>): string {
  if (!input) return ""

  switch (type) {
    case "shell_execute":
      return input.command as string || ""
    case "read_file":
    case "write_file":
    case "delete_file":
      return input.path as string || ""
    case "list_directory":
      return input.path as string || "."
    default:
      const firstValue = Object.values(input)[0]
      return typeof firstValue === "string" ? firstValue : ""
  }
}

const Tool = ({ toolPart, defaultOpen = false, className }: ToolProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const { state, input, output } = toolPart

  const isLoading = state === "input-streaming" || state === "input-available"
  const isError = state === "output-error"
  const isSuccess = state === "output-available"

  const formatValue = (value: unknown): string => {
    if (value === null) return "null"
    if (value === undefined) return "undefined"
    if (typeof value === "string") return value
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  const summary = getToolSummary(toolPart.type, input)

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
            getToolIcon(toolPart.type)
          )}
        </div>

        {/* Tool name and summary */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-medium text-foreground">
            {getToolDisplayName(toolPart.type)}
          </span>
          {summary && (
            <span className="truncate font-mono text-xs text-muted-foreground">
              {summary}
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
        <div className="mt-1 space-y-2 rounded-lg bg-secondary/30 p-3 text-xs">
          {/* Input */}
          {input && Object.keys(input).length > 0 && (
            <div>
              <div className="mb-1 font-medium text-muted-foreground">Input</div>
              <div className="rounded bg-background/50 p-2 font-mono">
                {Object.entries(input).map(([key, value]) => (
                  <div key={key} className="break-all">
                    <span className="text-muted-foreground">{key}:</span>{" "}
                    <span className="text-foreground">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Output */}
          {output && (
            <div>
              <div className="mb-1 font-medium text-muted-foreground">Output</div>
              <div className="max-h-40 overflow-auto rounded bg-background/50 p-2 font-mono">
                <pre className="whitespace-pre-wrap break-all text-foreground">
                  {formatValue(output)}
                </pre>
              </div>
            </div>
          )}

          {/* Error */}
          {isError && toolPart.errorText && (
            <div>
              <div className="mb-1 font-medium text-red-500">Error</div>
              <div className="rounded bg-red-500/10 p-2 text-red-400">
                {toolPart.errorText}
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && !input && (
            <div className="text-muted-foreground">Processing...</div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { Tool }
