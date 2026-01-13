"use client"

import { ChevronDown, Sparkles } from "lucide-react"
import { useState } from "react"
import { cn } from "../lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible"
import { Markdown } from "./markdown"

export interface ReasoningProps {
  /** The reasoning/thinking text content */
  content: string
  /** Whether the reasoning is still being streamed */
  isStreaming?: boolean
  /** Initial open/closed state */
  defaultOpen?: boolean
  /** Custom className for the container */
  className?: string
}

/**
 * Reasoning component for displaying AI thinking/reasoning traces.
 *
 * Features:
 * - Collapsible content with smooth animation
 * - Visual indicator for streaming state
 * - Markdown rendering support
 * - Styled for extended thinking traces
 */
export function Reasoning({
  content,
  isStreaming = false,
  defaultOpen = false,
  className,
}: ReasoningProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Don't render if no content and not streaming
  if (!content && !isStreaming) {
    return null
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn("w-full", className)}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50">
        <div className="flex items-center gap-2">
          <Sparkles className={cn("h-4 w-4 text-purple-500", isStreaming && "animate-pulse")} />
          <span className="font-medium text-muted-foreground">
            {isStreaming ? "Thinking..." : "Thought process"}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="mt-2 rounded-lg border border-border/30 bg-muted/20 px-4 py-3">
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 leading-relaxed">
            {content ? (
              <Markdown>{content}</Markdown>
            ) : (
              <span className="italic text-muted-foreground/70">Starting to think...</span>
            )}
            {isStreaming && (
              <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-purple-500/50 align-middle" />
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export interface ReasoningBlockProps {
  /** The reasoning/thinking text content */
  content: string
  /** Whether the reasoning is still being streamed */
  isStreaming?: boolean
  /** Custom className for the container */
  className?: string
}

/**
 * Inline reasoning block - a simpler non-collapsible version
 * for displaying reasoning in a more prominent way.
 */
export function ReasoningBlock({ content, isStreaming = false, className }: ReasoningBlockProps) {
  if (!content && !isStreaming) {
    return null
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-purple-500/20 bg-purple-50/50 px-4 py-3 dark:bg-purple-950/20",
        className
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className={cn("h-4 w-4 text-purple-500", isStreaming && "animate-pulse")} />
        <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
          {isStreaming ? "Thinking..." : "Thought process"}
        </span>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground prose-p:my-1.5 leading-relaxed">
        {content ? (
          <Markdown>{content}</Markdown>
        ) : (
          <span className="italic text-muted-foreground/70">Starting to think...</span>
        )}
        {isStreaming && (
          <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-purple-500/50 align-middle" />
        )}
      </div>
    </div>
  )
}
