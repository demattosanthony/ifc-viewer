"use client"

import { CodeBlockCode, Markdown } from "@ifc-viewer/ui/components"
import { cn } from "@ifc-viewer/ui/lib"
import { CheckCircle2, ChevronDown, Code2, File, Loader2, Terminal, XCircle } from "lucide-react"
import { useState } from "react"
import type { UIReasoningPart, UIToolPart } from "../types"

// Icon mapping for tool types
function getToolIcon(name: string) {
  if (["writeFile", "write_file"].includes(name)) return File
  if (["readFile", "read_file"].includes(name)) return File
  if (["executeCommand", "shell_execute"].includes(name)) return Terminal
  if (name === "executePython") return Code2
  return Terminal
}

// Get display title for a tool
function getToolTitle(tool: UIToolPart): string {
  const input = tool.input || {}

  // Use title if provided
  if (typeof input.title === "string") return input.title

  // Generate from tool name and first param
  const name = tool.name
  if (["writeFile", "write_file"].includes(name)) {
    return `Writing ${input.path || "file"}`
  }
  if (["readFile", "read_file"].includes(name)) {
    return `Reading ${input.path || "file"}`
  }
  if (["executeCommand", "shell_execute"].includes(name)) {
    const cmd = typeof input.command === "string" ? input.command : ""
    return cmd.length > 40 ? `${cmd.slice(0, 40)}...` : cmd || "Running command"
  }
  if (name === "executePython") {
    return "Running Python"
  }
  return name.replace(/([A-Z])/g, " $1").trim()
}

// Get right-side label (file name, etc.)
function getRightLabel(tool: UIToolPart): string | null {
  const input = tool.input || {}
  if (typeof input.path === "string") {
    return input.path.split("/").pop() || null
  }
  return null
}

// Clean up shell output for display
function cleanShellOutput(output: string): string {
  return output
    .split("\n")
    .filter((line) => {
      if (line.includes("/workspace $") || line.includes("/workspace$")) return false
      if (line.includes("<<CMD_DONE:")) return false
      return true
    })
    .join("\n")
    .trim()
}

// Get file extension for syntax highlighting
function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    json: "json",
    css: "css",
    html: "html",
    md: "markdown",
    sh: "bash",
    yml: "yaml",
    yaml: "yaml",
  }
  return langMap[ext || ""] || "plaintext"
}

interface ToolStepItemProps {
  tool: UIToolPart
}

export function ToolStepItem({ tool }: ToolStepItemProps) {
  const [isOpen, setIsOpen] = useState(false)

  const Icon = getToolIcon(tool.name)
  const title = getToolTitle(tool)
  const rightLabel = getRightLabel(tool)
  const input = tool.input || {}
  const output = tool.output as Record<string, unknown> | undefined

  const isLoading =
    tool.state === "streaming" || tool.state === "running" || tool.state === "pending"
  const isError =
    tool.state === "error" || (tool.state === "completed" && output?.success === false)
  const isSuccess = tool.state === "completed" && !isError

  const hasDetails = !!(tool.output || tool.error || input.code || input.content || input.command)

  return (
    <div className={cn("rounded-md transition-colors", isError && "bg-red-500/5")}>
      <button
        type="button"
        className="flex w-full items-center gap-2 py-1.5 text-left text-sm"
        onClick={() => hasDetails && setIsOpen(!isOpen)}
        disabled={!hasDetails}
      >
        {/* Status/Type Icon */}
        <div className="shrink-0">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin text-blue-500" />
          ) : isError ? (
            <XCircle className="size-4 text-red-500" />
          ) : isSuccess ? (
            <CheckCircle2 className="size-4 text-green-500" />
          ) : (
            <Icon className="size-4 text-muted-foreground" />
          )}
        </div>

        {/* Title */}
        <span className="flex-1 truncate text-foreground">{title}</span>

        {/* Right label or expand chevron */}
        {rightLabel && !hasDetails && (
          <span className="text-xs text-muted-foreground font-mono">{rightLabel}</span>
        )}
        {hasDetails && (
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Expandable details */}
      {isOpen && hasDetails && (
        <ToolDetails tool={tool} input={input} output={output} isLoading={isLoading} />
      )}
    </div>
  )
}

/** Renders tool-specific details based on tool type */
function ToolDetails({
  tool,
  input,
  output,
  isLoading,
}: {
  tool: UIToolPart
  input: Record<string, unknown>
  output: Record<string, unknown> | undefined
  isLoading: boolean
}) {
  const errorText = tool.error || (output?.error as string | undefined)

  // Python tool
  if (tool.name === "executePython") {
    const code = input.code as string | undefined
    const outputText = output?.output as string | undefined

    return (
      <div className="mt-1 mb-2 rounded-md overflow-hidden border border-border/50">
        {code && (
          <div className="max-h-48 overflow-auto">
            <CodeBlockCode code={code} language="python" className="text-xs" />
          </div>
        )}
        {(outputText || isLoading || errorText) && (
          <div className="border-t border-border/50 bg-secondary/30">
            {outputText && (
              <div className="max-h-32 overflow-auto p-2">
                <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">
                  {outputText}
                </pre>
              </div>
            )}
            {isLoading && !outputText && (
              <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Running...
              </div>
            )}
            {errorText && (
              <div className="border-t border-red-500/20 bg-red-500/5 p-2">
                <pre className="whitespace-pre-wrap font-mono text-xs text-red-400">
                  {errorText}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Shell/command tool
  if (["executeCommand", "shell_execute"].includes(tool.name)) {
    const command = input.command as string | undefined
    const rawOutput = output?.output as string | undefined
    const cleanedOutput = rawOutput ? cleanShellOutput(rawOutput) : ""

    return (
      <div className="mt-1 mb-2 rounded-md overflow-hidden border border-border/50">
        {command && (
          <div className="bg-secondary/50 px-2 py-1.5">
            <code className="font-mono text-xs text-muted-foreground">
              <span className="text-green-500/70">$</span> {command}
            </code>
          </div>
        )}
        {(cleanedOutput || isLoading || errorText) && (
          <div className="bg-secondary/30">
            {cleanedOutput && (
              <div className="max-h-32 overflow-auto p-2">
                <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground leading-relaxed">
                  {cleanedOutput}
                </pre>
              </div>
            )}
            {isLoading && !cleanedOutput && (
              <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Running...
              </div>
            )}
            {errorText && (
              <div className="border-t border-red-500/20 bg-red-500/5 p-2">
                <pre className="whitespace-pre-wrap font-mono text-xs text-red-400">
                  {errorText}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Write file tool
  if (["writeFile", "write_file"].includes(tool.name)) {
    const path = input.path as string | undefined
    const content = input.content as string | undefined
    const language = path ? getLanguageFromPath(path) : "plaintext"

    return (
      <div className="mt-1 mb-2 rounded-md overflow-hidden border border-border/50">
        {content && (
          <div className="max-h-48 overflow-auto">
            <CodeBlockCode code={content} language={language} className="text-xs" />
          </div>
        )}
        {errorText && (
          <div className="border-t border-red-500/20 bg-red-500/5 p-2">
            <pre className="whitespace-pre-wrap font-mono text-xs text-red-400">{errorText}</pre>
          </div>
        )}
      </div>
    )
  }

  // Read file tool
  if (["readFile", "read_file"].includes(tool.name)) {
    const path = input.path as string | undefined
    const content = output?.content as string | undefined
    const language = path ? getLanguageFromPath(path) : "plaintext"

    return (
      <div className="mt-1 mb-2 rounded-md overflow-hidden border border-border/50">
        {content && (
          <div className="max-h-48 overflow-auto">
            <CodeBlockCode code={content} language={language} className="text-xs" />
          </div>
        )}
        {isLoading && !content && (
          <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground bg-secondary/30">
            <Loader2 className="size-3 animate-spin" />
            Reading...
          </div>
        )}
        {errorText && (
          <div className="bg-red-500/5 p-2">
            <pre className="whitespace-pre-wrap font-mono text-xs text-red-400">{errorText}</pre>
          </div>
        )}
      </div>
    )
  }

  // Fallback for unknown tools
  return (
    <div className="mt-1 mb-2 rounded-md bg-secondary/30 p-2 text-xs overflow-hidden">
      {errorText && <pre className="text-red-400 whitespace-pre-wrap mb-2">{errorText}</pre>}
      {output != null && (
        <pre className="text-muted-foreground whitespace-pre-wrap overflow-auto max-h-32">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </div>
  )
}

interface ReasoningStepItemProps {
  reasoning: UIReasoningPart
}

export function ReasoningStepItem({ reasoning }: ReasoningStepItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isStreaming = reasoning.state === "streaming"

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 py-1.5 text-left text-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
        <span
          className={cn("flex-1 text-muted-foreground truncate", isStreaming && "animate-pulse")}
        >
          {isStreaming ? "Thinking..." : "Thought process"}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="mt-1 mb-2 pl-4 text-sm text-muted-foreground max-h-48 overflow-auto">
          <Markdown>{reasoning.text}</Markdown>
        </div>
      )}
    </div>
  )
}
