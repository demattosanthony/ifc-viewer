"use client"

import { Markdown } from "@ifc-viewer/ui/components"
import { cn } from "@ifc-viewer/ui/lib"
import { ChevronDown } from "lucide-react"
import { useState } from "react"
import type { UIReasoningPart } from "../types"

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
