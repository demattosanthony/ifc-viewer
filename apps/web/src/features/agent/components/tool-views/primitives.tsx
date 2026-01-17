"use client"

import { CodeBlockCode } from "@ifc-viewer/ui/components"
import { cn } from "@ifc-viewer/ui/lib"
import { Check, CheckCircle2, Copy, Loader2, type LucideIcon, XCircle } from "lucide-react"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"

// ============================================================================
// Tool Status Icon
// ============================================================================

interface ToolStatusIconProps {
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  fallbackIcon?: LucideIcon
  className?: string
}

export function ToolStatusIcon({
  isLoading,
  isSuccess,
  isError,
  fallbackIcon: FallbackIcon,
  className,
}: ToolStatusIconProps) {
  const iconClass = cn("size-4 shrink-0", className)

  if (isLoading) {
    return <Loader2 className={cn(iconClass, "animate-spin text-blue-500")} />
  }
  if (isError) {
    return <XCircle className={cn(iconClass, "text-red-500")} />
  }
  if (isSuccess) {
    return <CheckCircle2 className={cn(iconClass, "text-green-500")} />
  }
  if (FallbackIcon) {
    return <FallbackIcon className={cn(iconClass, "text-muted-foreground")} />
  }
  return null
}

// ============================================================================
// Copy Button
// ============================================================================

interface CopyButtonProps {
  content: string
  size?: "sm" | "md"
  className?: string
}

export function CopyButton({ content, size = "md", className }: CopyButtonProps) {
  const { copied, copy } = useCopyToClipboard()

  const iconSize = size === "sm" ? "size-3" : "size-3.5"

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        copy(content)
      }}
      className={cn(
        "rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className
      )}
      title="Copy"
    >
      {copied ? (
        <Check className={cn(iconSize, "text-green-500")} />
      ) : (
        <Copy className={iconSize} />
      )}
    </button>
  )
}

// ============================================================================
// Error Display
// ============================================================================

interface ErrorDisplayProps {
  error: string
  className?: string
}

export function ErrorDisplay({ error, className }: ErrorDisplayProps) {
  return (
    <div className={cn("border-t border-red-500/20 bg-red-500/5 p-2", className)}>
      <pre className="whitespace-pre-wrap font-mono text-xs text-red-400">{error}</pre>
    </div>
  )
}

// ============================================================================
// Loading Indicator
// ============================================================================

interface LoadingIndicatorProps {
  text?: string
  className?: string
}

export function LoadingIndicator({ text = "Running...", className }: LoadingIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2 p-2 text-xs text-muted-foreground", className)}>
      <Loader2 className="size-3 animate-spin" />
      {text}
    </div>
  )
}

// ============================================================================
// Code Display
// ============================================================================

interface CodeDisplayProps {
  code: string
  language: string
  maxHeight?: string
  isStreaming?: boolean
  showCopyButton?: boolean
  className?: string
}

export function CodeDisplay({
  code,
  language,
  maxHeight = "max-h-72",
  isStreaming,
  showCopyButton = true,
  className,
}: CodeDisplayProps) {
  return (
    <div className={cn("relative", className)}>
      {showCopyButton && (
        <div className="absolute right-2 top-2 z-10">
          <CopyButton content={code} />
        </div>
      )}
      <div className={cn(maxHeight, "overflow-auto")}>
        <CodeBlockCode code={code} language={language} className="text-[13px]" />
        {isStreaming && (
          <span className="ml-3 mb-3 inline-block h-4 w-0.5 animate-pulse bg-blue-500" />
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Output Section
// ============================================================================

interface OutputSectionProps {
  output?: string
  isLoading?: boolean
  error?: string
  loadingText?: string
  showCopyButton?: boolean
  maxHeight?: string
  className?: string
}

export function OutputSection({
  output,
  isLoading,
  error,
  loadingText = "Running...",
  showCopyButton = true,
  maxHeight = "max-h-72",
  className,
}: OutputSectionProps) {
  const hasOutput = output && output.length > 0

  if (!hasOutput && !isLoading && !error) {
    return null
  }

  return (
    <div className={cn("border-t border-border bg-secondary/20", className)}>
      {/* Output content */}
      {hasOutput && (
        <div className="relative">
          {showCopyButton && (
            <div className="absolute right-2 top-2">
              <CopyButton content={output} />
            </div>
          )}
          <div className={cn(maxHeight, "overflow-auto p-3 pr-10")}>
            <pre className="whitespace-pre-wrap font-mono text-xs text-foreground leading-relaxed">
              {output}
            </pre>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !hasOutput && <LoadingIndicator text={loadingText} className="p-3" />}

      {/* Error display */}
      {error && <ErrorDisplay error={error} className="border-t" />}
    </div>
  )
}
