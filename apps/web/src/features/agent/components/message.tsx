import { Markdown, ReasoningBlock } from "@ifc-viewer/ui/components"
import { memo } from "react"
import type { StreamingMessage, UIMessagePart, UIReasoningPart } from "../types"
import { ReasoningStepItem } from "./step-item"
import { StepsBlock } from "./steps-block"
import { ToolCard } from "./tool-views/tool-card"

interface ChatMessageProps {
  message: StreamingMessage
}

function ReasoningCard({ reasoning }: { reasoning: UIReasoningPart }) {
  return <ReasoningBlock content={reasoning.text} isStreaming={reasoning.state === "streaming"} />
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="max-w-[80%] rounded-xl bg-card px-3 py-2 text-sm text-foreground border border-border">
      {content}
    </div>
  )
}

function AssistantText({ content }: { content: string }) {
  if (!content.trim()) return null
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground leading-relaxed">
      <Markdown>{content}</Markdown>
    </div>
  )
}

/**
 * Merge consecutive text parts into single text parts.
 * This prevents visual line breaks between text from different steps
 * when there are no tool calls in between.
 */
function mergeConsecutiveTextParts(parts: UIMessagePart[]): UIMessagePart[] {
  const merged: UIMessagePart[] = []

  for (const part of parts) {
    const last = merged[merged.length - 1]

    if (part.type === "text" && last?.type === "text") {
      // Merge with previous text part
      merged[merged.length - 1] = {
        ...last,
        text: last.text + part.text,
      }
    } else {
      merged.push(part)
    }
  }

  return merged
}

/**
 * Group consecutive non-text parts (tools and reasoning) together.
 * Text parts break the groups and are returned as-is.
 */
function groupParts(parts: UIMessagePart[]): Array<UIMessagePart | UIMessagePart[]> {
  const result: Array<UIMessagePart | UIMessagePart[]> = []
  let currentGroup: UIMessagePart[] = []

  for (const part of parts) {
    if (part.type === "text") {
      // Flush any accumulated group
      if (currentGroup.length > 0) {
        result.push(currentGroup.length === 1 ? currentGroup[0]! : [...currentGroup])
        currentGroup = []
      }
      result.push(part)
    } else {
      // Accumulate tool-use and reasoning parts
      currentGroup.push(part)
    }
  }

  // Flush remaining group
  if (currentGroup.length > 0) {
    result.push(currentGroup.length === 1 ? currentGroup[0]! : [...currentGroup])
  }

  return result
}

/**
 * Render a step part inside the StepsBlock timeline.
 */
function renderStepPart(part: UIMessagePart, _index: number) {
  if (part.type === "tool-use") {
    return <ToolCard key={part.id} tool={part} variant="compact" />
  }
  if (part.type === "reasoning") {
    return <ReasoningStepItem key={part.id} reasoning={part} />
  }
  return null
}

function renderMessagePart(part: UIMessagePart, index: number) {
  if (part.type === "text") {
    return <AssistantText key={`text-${index}`} content={part.text} />
  }

  if (part.type === "tool-use") {
    return <ToolCard key={`tool-${part.id}`} tool={part} variant="full" />
  }

  if (part.type === "reasoning") {
    return <ReasoningCard key={`reasoning-${part.id}`} reasoning={part} />
  }

  return null
}

export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"
  const hasParts = message.parts && message.parts.length > 0
  const hasContent = message.content.trim().length > 0

  // Don't render empty assistant messages without parts
  if (!isUser && !hasContent && !hasParts) {
    return null
  }

  // User message - compact rounded box
  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <UserMessage content={message.content} />
      </div>
    )
  }

  // Assistant message - flowing text with inline tools
  // Merge consecutive text parts to prevent visual breaks between steps
  const partsToRender = hasParts ? mergeConsecutiveTextParts(message.parts!) : []
  const groupedParts = groupParts(partsToRender)

  return (
    <div className="w-full space-y-3">
      {hasParts
        ? groupedParts.map((item, index) => {
            // Single text part
            if (!Array.isArray(item) && item.type === "text") {
              return <AssistantText key={`text-${index}`} content={item.text} />
            }

            // Single tool/reasoning (don't group if only one)
            if (!Array.isArray(item)) {
              return renderMessagePart(item, index)
            }

            // Group of 2+ tools/reasoning → StepsBlock
            // Check if there's text content after this group
            const hasTextAfter = groupedParts
              .slice(index + 1)
              .some((p) => !Array.isArray(p) && p.type === "text")

            // Calculate streaming status for THIS specific group only
            const isGroupStreaming = item.some(
              (p) =>
                (p.type === "tool-use" && (p.state === "streaming" || p.state === "running")) ||
                (p.type === "reasoning" && p.state === "streaming")
            )

            return (
              <StepsBlock
                key={`steps-${index}`}
                parts={item}
                isStreaming={isGroupStreaming}
                hasTextAfter={hasTextAfter}
                renderPart={renderStepPart}
              />
            )
          })
        : hasContent && <AssistantText content={message.content} />}
    </div>
  )
})
