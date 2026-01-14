"use client"

import { ChevronRightIcon } from "lucide-react"
import type React from "react"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { cn } from "../lib/utils.ts"
import { Markdown } from "./markdown"

type ReasoningContextType = {
  isOpen: boolean
  isStreaming: boolean
  onOpenChange: (open: boolean) => void
}

const ReasoningContext = createContext<ReasoningContextType | undefined>(undefined)

function useReasoningContext() {
  const context = useContext(ReasoningContext)
  if (!context) {
    throw new Error("useReasoningContext must be used within a Reasoning provider")
  }
  return context
}

export type ReasoningProps = {
  children: React.ReactNode
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  isStreaming?: boolean
}
function Reasoning({
  children,
  className,
  open,
  onOpenChange,
  isStreaming = false,
}: ReasoningProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [wasAutoOpened, setWasAutoOpened] = useState(false)

  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }

  useEffect(() => {
    if (isStreaming && !wasAutoOpened) {
      if (!isControlled) setInternalOpen(true)
      setWasAutoOpened(true)
    }

    if (!isStreaming && wasAutoOpened) {
      if (!isControlled) setInternalOpen(false)
      setWasAutoOpened(false)
    }
  }, [isStreaming, wasAutoOpened, isControlled])

  return (
    <ReasoningContext.Provider
      value={{
        isOpen,
        isStreaming,
        onOpenChange: handleOpenChange,
      }}
    >
      <div className={className}>{children}</div>
    </ReasoningContext.Provider>
  )
}

export type ReasoningTriggerProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLButtonElement>

function ReasoningTrigger({ children, className, ...props }: ReasoningTriggerProps) {
  const { isOpen, onOpenChange } = useReasoningContext()

  return (
    <button
      className={cn("flex cursor-pointer items-center gap-2", className)}
      onClick={() => onOpenChange(!isOpen)}
      {...props}
    >
      <span className="text-primary">{children}</span>
      <div className={cn("transform transition-transform", isOpen ? "rotate-90" : "")}>
        <ChevronRightIcon className="size-4" />
      </div>
    </button>
  )
}

export type ReasoningContentProps = {
  children: React.ReactNode
  className?: string
  markdown?: boolean
  contentClassName?: string
} & React.HTMLAttributes<HTMLDivElement>

function ReasoningContent({
  children,
  className,
  contentClassName,
  markdown = false,
  ...props
}: ReasoningContentProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const { isOpen } = useReasoningContext()

  useEffect(() => {
    if (!contentRef.current || !innerRef.current) return

    const observer = new ResizeObserver(() => {
      if (contentRef.current && innerRef.current && isOpen) {
        contentRef.current.style.maxHeight = `${innerRef.current.scrollHeight}px`
      }
    })

    observer.observe(innerRef.current)

    if (isOpen) {
      contentRef.current.style.maxHeight = `${innerRef.current.scrollHeight}px`
    }

    return () => observer.disconnect()
  }, [isOpen])

  const content = markdown ? <Markdown>{children as string}</Markdown> : children

  return (
    <div
      ref={contentRef}
      className={cn("overflow-hidden transition-[max-height] duration-150 ease-out", className)}
      style={{
        maxHeight: isOpen ? contentRef.current?.scrollHeight : "0px",
      }}
      {...props}
    >
      <div
        ref={innerRef}
        className={cn("text-muted-foreground prose prose-sm dark:prose-invert", contentClassName)}
      >
        {content}
      </div>
    </div>
  )
}

/**
 * ReasoningBlock - A subtle, inline thinking indicator that doesn't interrupt content flow.
 * Uses a left-border accent style similar to blockquotes.
 */
export type ReasoningBlockProps = {
  /** The reasoning text content */
  content: string
  /** Whether the reasoning is currently streaming */
  isStreaming?: boolean
  /** Additional class name for the container */
  className?: string
}

function ReasoningBlock({ content, isStreaming = false, className }: ReasoningBlockProps) {
  const { isOpen, onOpenChange } = useReasoningBlockState(isStreaming)

  return (
    <div className={cn("group", className)}>
      {/* Trigger - minimal, just text and chevron */}
      <button
        className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-xs transition-colors"
        onClick={() => onOpenChange(!isOpen)}
      >
        <ChevronRightIcon
          className={cn("size-3 transition-transform duration-200", isOpen && "rotate-90")}
        />
        <span className={cn(isStreaming && "animate-pulse")}>
          {isStreaming ? "Thinking…" : "Thought process"}
        </span>
      </button>

      {/* Collapsible Content - blockquote style with left border */}
      <ReasoningCollapsibleContent isOpen={isOpen}>
        <div className="border-muted-foreground/25 mt-2 border-l-2 pl-3">
          <div className="text-muted-foreground prose-sm max-h-48 overflow-y-auto text-[13px] leading-relaxed">
            <Markdown>{content}</Markdown>
          </div>
        </div>
      </ReasoningCollapsibleContent>
    </div>
  )
}

/** Internal hook for ReasoningBlock state management */
function useReasoningBlockState(isStreaming: boolean) {
  const [isOpen, setIsOpen] = useState(false)
  const [wasAutoOpened, setWasAutoOpened] = useState(false)

  useEffect(() => {
    if (isStreaming && !wasAutoOpened) {
      setIsOpen(true)
      setWasAutoOpened(true)
    }

    if (!isStreaming && wasAutoOpened) {
      setIsOpen(false)
      setWasAutoOpened(false)
    }
  }, [isStreaming, wasAutoOpened])

  return { isOpen, onOpenChange: setIsOpen }
}

/** Internal collapsible content for ReasoningBlock */
function ReasoningCollapsibleContent({
  isOpen,
  children,
}: {
  isOpen: boolean
  children: React.ReactNode
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contentRef.current || !innerRef.current) return

    const observer = new ResizeObserver(() => {
      if (contentRef.current && innerRef.current && isOpen) {
        contentRef.current.style.maxHeight = `${innerRef.current.scrollHeight}px`
      }
    })

    observer.observe(innerRef.current)

    if (isOpen) {
      contentRef.current.style.maxHeight = `${innerRef.current.scrollHeight}px`
    }

    return () => observer.disconnect()
  }, [isOpen])

  return (
    <div
      ref={contentRef}
      className="overflow-hidden transition-[max-height] duration-200 ease-out"
      style={{ maxHeight: isOpen ? contentRef.current?.scrollHeight : "0px" }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  )
}

export { Reasoning, ReasoningTrigger, ReasoningContent, ReasoningBlock }
