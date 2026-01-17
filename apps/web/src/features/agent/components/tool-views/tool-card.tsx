"use client"

import {
  CodeBlockCode,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ifc-viewer/ui/components"
import { cn } from "@ifc-viewer/ui/lib"
import { ChevronDown, File } from "lucide-react"
import { useState } from "react"
import type { UIToolPart } from "../../types"
import {
  cleanShellOutput,
  formatViewerOutput,
  getFileName,
  getLanguageFromPath,
  getToolType,
} from "../../utils"
import {
  CodeDisplay,
  CopyButton,
  ErrorDisplay,
  LoadingIndicator,
  OutputSection,
  ToolStatusIcon,
} from "./primitives"
import { getToolConfig, getToolIcon, getToolRightLabel, getToolTitle } from "./registry"

// ============================================================================
// Tool Card Props
// ============================================================================

interface ToolCardProps {
  tool: UIToolPart
  /** full = standalone card with expanded details, compact = timeline item */
  variant: "full" | "compact"
}

// ============================================================================
// Tool State Helpers
// ============================================================================

function getToolState(tool: UIToolPart) {
  const isLoading =
    tool.state === "streaming" || tool.state === "running" || tool.state === "pending"
  const output = tool.output as Record<string, unknown> | undefined
  const isError =
    tool.state === "error" || (tool.state === "completed" && output?.success === false)
  const isSuccess = tool.state === "completed" && !isError

  let errorText = tool.error
  if (!errorText && isError && output?.error) {
    errorText = String(output.error)
  }

  return { isLoading, isError, isSuccess, errorText }
}

// ============================================================================
// Content Renderers
// ============================================================================

interface ContentProps {
  tool: UIToolPart
  input: Record<string, unknown>
  output: Record<string, unknown> | undefined
  isLoading: boolean
  errorText?: string
  variant: "full" | "compact"
}

/** Write file tool content */
function WriteFileContent({ input, isLoading, errorText, variant }: ContentProps) {
  const path = input.path as string | undefined
  const content = input.content as string | undefined
  const language = path ? getLanguageFromPath(path) : "plaintext"
  const fileName = path ? getFileName(path) : "file"

  if (variant === "full") {
    // Full variant: file preview card
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
          {content && <CopyButton content={content} />}
        </div>
        {/* Code */}
        {content && (
          <div className="max-h-80 overflow-auto">
            <CodeBlockCode code={content} language={language} className="text-[13px]" />
            {isLoading && (
              <span className="ml-3 mb-3 inline-block h-4 w-0.5 animate-pulse bg-blue-500" />
            )}
          </div>
        )}
      </div>
    )
  }

  // Compact variant
  return (
    <div className="mt-1 mb-2 rounded-md overflow-hidden border border-border/50">
      {content && (
        <div className="max-h-72 overflow-auto">
          <CodeBlockCode code={content} language={language} className="text-xs" />
        </div>
      )}
      {errorText && <ErrorDisplay error={errorText} />}
    </div>
  )
}

/** Read file tool content */
function ReadFileContent({ input, output, isLoading, errorText, variant }: ContentProps) {
  const path = input.path as string | undefined
  const content = output?.content as string | undefined
  const language = path ? getLanguageFromPath(path) : "plaintext"
  const fileName = path ? getFileName(path) : "file"
  const hasContent = content && content.length > 0

  if (variant === "full") {
    // Full variant: collapsible card
    return (
      <ReadFileCollapsible
        fileName={fileName}
        content={content}
        isError={!!errorText}
        errorText={errorText}
      />
    )
  }

  // Compact variant
  return (
    <div className="mt-1 mb-2 rounded-md overflow-hidden border border-border/50">
      {hasContent && (
        <div className="max-h-72 overflow-auto">
          <CodeBlockCode code={content} language={language} className="text-xs" />
        </div>
      )}
      {isLoading && !hasContent && (
        <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground bg-secondary/30">
          <LoadingIndicator text="Reading..." />
        </div>
      )}
      {errorText && <ErrorDisplay error={errorText} />}
    </div>
  )
}

/** Read file full variant with collapsible */
function ReadFileCollapsible({
  fileName,
  content,
  isError,
  errorText,
}: {
  fileName: string
  content?: string
  isError: boolean
  errorText?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const hasContent = content && content.length > 0

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "overflow-hidden rounded-lg border transition-colors",
          isError ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-left transition-colors",
              "hover:bg-secondary/50",
              isOpen && "border-b border-border"
            )}
          >
            <span className="text-sm text-foreground truncate">Read {fileName}</span>
            {(hasContent || isError) && (
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {hasContent && (
            <div className="relative">
              <div className="absolute right-2 top-2 z-10">
                <CopyButton content={content} />
              </div>
              <div className="max-h-60 overflow-y-auto p-3 pr-10">
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground leading-relaxed">
                  {content}
                </pre>
              </div>
            </div>
          )}
          {isError && errorText && <ErrorDisplay error={errorText} />}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

/** Command tool content */
function CommandContent({ input, output, isLoading, errorText, variant }: ContentProps) {
  const command = input.command as string | undefined
  const title = input.title as string | undefined
  const rawOutput = output?.output as string | undefined
  const cleanedOutput = rawOutput ? cleanShellOutput(rawOutput) : ""
  const hasOutput = cleanedOutput.length > 0
  const result = output as { success?: boolean; exitCode?: number } | undefined
  const isSuccess = result?.success !== false && !errorText
  const isError = result?.success === false || !!errorText

  if (variant === "full") {
    return (
      <CommandCollapsible
        title={title}
        command={command}
        output={cleanedOutput}
        hasOutput={hasOutput}
        isLoading={isLoading}
        isSuccess={isSuccess}
        isError={isError}
        errorText={errorText}
      />
    )
  }

  // Compact variant
  return (
    <div className="mt-1 mb-2 rounded-md overflow-hidden border border-border/50">
      {command && (
        <div className="bg-secondary/50 px-2 py-1.5">
          <code className="font-mono text-xs text-muted-foreground">
            <span className="text-green-500/70">$</span> {command}
          </code>
        </div>
      )}
      {(hasOutput || isLoading || errorText) && (
        <div className="bg-secondary/30">
          {hasOutput && (
            <div className="max-h-72 overflow-auto p-2">
              <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground leading-relaxed">
                {cleanedOutput}
              </pre>
            </div>
          )}
          {isLoading && !hasOutput && <LoadingIndicator text="Running..." />}
          {errorText && <ErrorDisplay error={errorText} />}
        </div>
      )}
    </div>
  )
}

/** Command full variant with collapsible */
function CommandCollapsible({
  title,
  command,
  output,
  hasOutput,
  isLoading,
  isSuccess,
  isError,
  errorText,
}: {
  title?: string
  command?: string
  output: string
  hasOutput: boolean
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  errorText?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const displayTitle = title || command || "Running command"

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "overflow-hidden rounded-lg border transition-colors",
          isError ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-left transition-colors",
              "hover:bg-secondary/50",
              isOpen && "border-b border-border"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ToolStatusIcon isLoading={isLoading} isSuccess={isSuccess} isError={isError} />
              <span className="text-sm text-foreground truncate">{displayTitle}</span>
            </div>
            {(hasOutput || errorText) && (
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-0">
            {command && (
              <div className="flex items-center justify-between border-b border-border/50 bg-secondary/30 px-3 py-1.5">
                <code className="font-mono text-xs text-muted-foreground truncate">
                  <span className="text-green-500/70">$</span> {command}
                </code>
                <CopyButton content={command} size="sm" />
              </div>
            )}
            {hasOutput && (
              <div className="max-h-72 overflow-auto p-3">
                <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground leading-relaxed">
                  {output}
                </pre>
              </div>
            )}
            {errorText && <ErrorDisplay error={errorText} />}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

/** Code execution tool content (Python and Viewer share similar structure) */
function CodeExecutionContent({
  tool,
  input,
  output,
  isLoading,
  errorText,
  variant,
}: ContentProps) {
  const code = input.code as string | undefined
  const title = input.title as string | undefined
  const toolType = getToolType(tool.name)
  const config = getToolConfig(tool.name)
  const language = config?.codeLanguage ?? "python"
  const loadingText = config?.loadingText ?? "Running..."

  // Format output based on tool type
  let outputText = ""
  if (toolType === "executeViewer" && output) {
    outputText = formatViewerOutput(output)
    if (outputText === "No result") outputText = ""
  } else if (output?.output) {
    outputText = String(output.output)
  }

  const hasOutput = outputText.length > 0
  const result = output as { success?: boolean; error?: string } | undefined
  const isSuccess = result?.success !== false && !errorText
  const isError = result?.success === false || !!errorText
  const displayError = errorText || result?.error

  if (variant === "full") {
    return (
      <CodeExecutionCollapsible
        title={title || config?.getTitle(input) || "Writing code"}
        code={code}
        language={language}
        output={outputText}
        hasOutput={hasOutput}
        isLoading={isLoading}
        isSuccess={isSuccess}
        isError={isError}
        errorText={displayError}
        loadingText={loadingText}
        isStreaming={tool.state === "streaming"}
      />
    )
  }

  // Compact variant
  return (
    <div className="mt-1 mb-2 rounded-md overflow-hidden border border-border/50">
      {code && (
        <div className="max-h-72 overflow-auto">
          <CodeBlockCode code={code} language={language} className="text-xs" />
        </div>
      )}
      {(hasOutput || isLoading || displayError) && (
        <div className="border-t border-border/50 bg-secondary/30">
          {hasOutput && (
            <div className="max-h-72 overflow-auto p-2">
              <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">
                {outputText}
              </pre>
            </div>
          )}
          {isLoading && !hasOutput && <LoadingIndicator text={loadingText} />}
          {displayError && <ErrorDisplay error={displayError} />}
        </div>
      )}
    </div>
  )
}

/** Code execution full variant with collapsible */
function CodeExecutionCollapsible({
  title,
  code,
  language,
  output,
  hasOutput,
  isLoading,
  isSuccess,
  isError,
  errorText,
  loadingText,
  isStreaming,
}: {
  title: string
  code?: string
  language: string
  output: string
  hasOutput: boolean
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  errorText?: string
  loadingText: string
  isStreaming: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "overflow-hidden rounded-lg border transition-colors",
          isError ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-left transition-colors",
              "hover:bg-secondary/50",
              isOpen && "border-b border-border"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ToolStatusIcon isLoading={isLoading} isSuccess={isSuccess} isError={isError} />
              <span className="text-sm text-foreground truncate">{title}</span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div>
            {code && (
              <CodeDisplay
                code={code}
                language={language}
                maxHeight="max-h-72"
                isStreaming={isStreaming}
              />
            )}
            <OutputSection
              output={hasOutput ? output : undefined}
              isLoading={isLoading && !hasOutput}
              error={errorText}
              loadingText={loadingText}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

/** Generic fallback content */
function GenericContent({ output, isLoading, errorText }: ContentProps) {
  const hasOutput = output && Object.keys(output).length > 0

  return (
    <div className="mt-1 mb-2 rounded-md bg-secondary/30 p-2 text-xs overflow-hidden">
      {errorText && <pre className="text-red-400 whitespace-pre-wrap mb-2">{errorText}</pre>}
      {hasOutput && (
        <pre className="text-muted-foreground whitespace-pre-wrap overflow-auto max-h-32">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
      {isLoading && !hasOutput && !errorText && (
        <div className="py-2 text-center text-xs text-muted-foreground">Processing...</div>
      )}
    </div>
  )
}

// ============================================================================
// Main ToolCard Component
// ============================================================================

export function ToolCard({ tool, variant }: ToolCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  const input = tool.input || {}
  const output = tool.output as Record<string, unknown> | undefined
  const { isLoading, isError, isSuccess, errorText } = getToolState(tool)
  const toolType = getToolType(tool.name)

  const Icon = getToolIcon(tool.name)
  const title = getToolTitle(tool.name, input)
  const rightLabel = getToolRightLabel(tool.name, input)

  const contentProps: ContentProps = {
    tool,
    input,
    output,
    isLoading,
    errorText,
    variant,
  }

  // For full variant, delegate to specialized components that handle their own UI
  if (variant === "full") {
    switch (toolType) {
      case "writeFile":
        return <WriteFileContent {...contentProps} />
      case "readFile":
        return <ReadFileContent {...contentProps} />
      case "executeCommand":
        return <CommandContent {...contentProps} />
      case "executePython":
      case "executeViewer":
        return <CodeExecutionContent {...contentProps} />
      default:
        // Generic fallback with collapsible
        return (
          <GenericCollapsible
            title={title}
            input={input}
            output={output}
            isLoading={isLoading}
            isSuccess={isSuccess}
            isError={isError}
            errorText={errorText}
          />
        )
    }
  }

  // Compact variant - all tools share the same header structure
  const hasDetails = !!(output || tool.error || input.code || input.content || input.command)

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
          <ToolStatusIcon
            isLoading={isLoading}
            isSuccess={isSuccess}
            isError={isError}
            fallbackIcon={Icon}
          />
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
      {isOpen && hasDetails && <ToolContent toolType={toolType} {...contentProps} />}
    </div>
  )
}

/** Route to correct content renderer for compact variant */
function ToolContent({ toolType, ...props }: ContentProps & { toolType?: string }) {
  switch (toolType) {
    case "writeFile":
      return <WriteFileContent {...props} />
    case "readFile":
      return <ReadFileContent {...props} />
    case "executeCommand":
      return <CommandContent {...props} />
    case "executePython":
    case "executeViewer":
      return <CodeExecutionContent {...props} />
    default:
      return <GenericContent {...props} />
  }
}

/** Generic collapsible for unknown tools (full variant) */
function GenericCollapsible({
  title,
  input,
  output,
  isLoading,
  isSuccess,
  isError,
  errorText,
}: {
  title: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  errorText?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const hasInput = Object.keys(input).length > 0
  const hasOutput = output && Object.keys(output).length > 0

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "overflow-hidden rounded-lg border transition-colors",
          isError ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-left transition-colors",
              "hover:bg-secondary/50",
              isOpen && "border-b border-border"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ToolStatusIcon isLoading={isLoading} isSuccess={isSuccess} isError={isError} />
              <span className="text-sm text-foreground truncate">{title}</span>
            </div>
            {(hasInput || hasOutput || errorText) && (
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 space-y-2">
            {hasInput && (
              <div>
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Input
                </div>
                <pre className="whitespace-pre-wrap break-all font-mono text-xs text-foreground bg-secondary/30 p-2 rounded">
                  {JSON.stringify(input, null, 2)}
                </pre>
              </div>
            )}
            {hasOutput && (
              <div>
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Output
                </div>
                <pre className="whitespace-pre-wrap break-all font-mono text-xs text-foreground bg-secondary/30 p-2 rounded max-h-40 overflow-auto">
                  {JSON.stringify(output, null, 2)}
                </pre>
              </div>
            )}
            {errorText && <ErrorDisplay error={errorText} />}
            {isLoading && !hasInput && !hasOutput && (
              <div className="py-2 text-center text-xs text-muted-foreground">Processing...</div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
