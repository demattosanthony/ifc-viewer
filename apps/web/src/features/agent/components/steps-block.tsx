"use client"

import { cn } from "@ifc-viewer/ui/lib"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import type { UIMessagePart } from "../types"

interface StepsBlockProps {
  /** The parts to render (tools and reasoning interleaved) */
  parts: UIMessagePart[]
  /** Whether any step is still streaming */
  isStreaming: boolean
  /** Whether there's text content after this steps block */
  hasTextAfter: boolean
  /** Render function for individual parts */
  renderPart: (part: UIMessagePart, index: number) => React.ReactNode
  className?: string
}

export function StepsBlock({
  parts,
  isStreaming,
  hasTextAfter,
  renderPart,
  className,
}: StepsBlockProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [wasAutoOpened, setWasAutoOpened] = useState(false)

  // Count only tool calls for the label
  const toolCount = parts.filter((p) => p.type === "tool-use").length

  // Auto-open while streaming, auto-close only when text follows
  useEffect(() => {
    if (isStreaming && !wasAutoOpened) {
      setIsOpen(true)
      setWasAutoOpened(true)
    }
    // Only auto-close when streaming is done AND there's text after this block
    if (!isStreaming && wasAutoOpened && hasTextAfter) {
      setIsOpen(false)
      setWasAutoOpened(false)
    }
  }, [isStreaming, wasAutoOpened, hasTextAfter])

  const label = isStreaming
    ? `${toolCount} step${toolCount !== 1 ? "s" : ""}...`
    : `${toolCount} step${toolCount !== 1 ? "s" : ""}`

  return (
    <div className={cn("", className)}>
      {/* Collapsible Header */}
      <button
        type="button"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span className={cn(isStreaming && "animate-pulse")}>{isOpen ? "Hide steps" : label}</span>
      </button>

      {/* Timeline Content */}
      {isOpen && (
        <div className="mt-2 ml-2 border-l-2 border-muted-foreground/20 pl-4 space-y-2">
          {parts.map((part, index) => (
            <div
              key={part.type === "tool-use" ? part.id : `reasoning-${index}`}
              className="relative"
            >
              {/* Timeline dot */}
              <div className="absolute -left-[21px] top-2.5 size-2 rounded-full bg-muted-foreground/40" />
              {renderPart(part, index)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
