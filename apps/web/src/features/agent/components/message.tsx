import { Markdown } from "@ifc-viewer/ui/components"
import { memo } from "react"
import type { StreamingMessage, UIMessagePart, UIToolPart } from "../types"
import { Tool, type ToolPart } from "./tool"
import { CommandPreview } from "./tool-views/command-preview"
import { FilePreview } from "./tool-views/file-preview"
import { PythonPreview } from "./tool-views/python-preview"
import { ReadFilePreview } from "./tool-views/read-file-preview"

interface ChatMessageProps {
  message: StreamingMessage
}

// Type guard for tool results with success/error pattern
interface ToolResult {
  success?: boolean
  error?: string
}

function isToolResult(value: unknown): value is ToolResult {
  return typeof value === "object" && value !== null && ("success" in value || "error" in value)
}

function getToolState(tool: UIToolPart): {
  isStreaming: boolean
  isComplete: boolean
  error?: string
} {
  const isStreaming = tool.state === "streaming"
  const isComplete = tool.state === "completed" || tool.state === "error"

  let error: string | undefined
  if (tool.state === "error") {
    error = tool.error
  } else if (tool.state === "completed" && isToolResult(tool.output)) {
    if (tool.output.success === false) {
      error = tool.output.error || "Tool execution failed"
    }
  }

  return { isStreaming, isComplete, error }
}

function mapToToolPart(tool: UIToolPart): ToolPart {
  let state: ToolPart["state"]

  switch (tool.state) {
    case "streaming":
      state = "streaming"
      break
    case "pending":
    case "running":
      state = "input-streaming"
      break
    case "completed": {
      const hasError = isToolResult(tool.output) && tool.output.success === false
      state = hasError ? "output-error" : "output-available"
      break
    }
    case "error":
      state = "output-error"
      break
    case "needs-approval":
      state = "input-available"
      break
    default:
      state = "input-streaming"
  }

  return {
    type: tool.name,
    state,
    input: tool.input,
    output: tool.output as Record<string, unknown> | undefined,
    toolCallId: tool.id,
    errorText: tool.error,
  }
}

function ToolCard({ tool }: { tool: UIToolPart }) {
  const { isStreaming, isComplete, error } = getToolState(tool)
  const input = tool.input
  const output = tool.output as Record<string, unknown> | undefined

  // Write file tool - content is in input
  if (["write_file", "writeFile"].includes(tool.name)) {
    const path = input?.path as string | undefined
    const content = input?.content as string | undefined

    if (path && content) {
      return <FilePreview path={path} content={content} isStreaming={isStreaming} />
    }
  }

  // Read file tool - content is in output
  if (["read_file", "readFile"].includes(tool.name)) {
    const path = input?.path as string | undefined

    if (path) {
      return (
        <ReadFilePreview
          path={path}
          result={output as { success?: boolean; content?: string; error?: string } | undefined}
          isStreaming={isStreaming}
          isComplete={isComplete}
        />
      )
    }
  }

  // Command tools
  if (["shell_execute", "executeCommand"].includes(tool.name)) {
    const command = input?.command as string | undefined
    const title = input?.title as string | undefined

    if (command) {
      return (
        <CommandPreview
          title={title}
          command={command}
          output={output}
          isStreaming={isStreaming}
          isComplete={isComplete}
          error={error}
        />
      )
    }
  }

  // Python execution tool
  if (tool.name === "executePython") {
    const code = input?.code as string | undefined
    const title = input?.title as string | undefined

    if (code) {
      return (
        <PythonPreview
          title={title}
          code={code}
          output={output}
          isStreaming={isStreaming}
          isComplete={isComplete}
          error={error}
        />
      )
    }
  }

  // Fallback to generic Tool component
  return <Tool toolPart={mapToToolPart(tool)} />
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="rounded-xl bg-secondary/80 px-4 py-3 text-sm text-foreground">{content}</div>
  )
}

function AssistantText({ content }: { content: string }) {
  if (!content.trim()) return null
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 leading-relaxed">
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

function renderMessagePart(part: UIMessagePart, index: number) {
  if (part.type === "text") {
    return <AssistantText key={`text-${index}`} content={part.text} />
  }

  if (part.type === "tool-use") {
    return <ToolCard key={`tool-${part.id}`} tool={part} />
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
      <div className="w-full">
        <UserMessage content={message.content} />
      </div>
    )
  }

  // Assistant message - flowing text with inline tools
  // Merge consecutive text parts to prevent visual breaks between steps
  const partsToRender = hasParts ? mergeConsecutiveTextParts(message.parts!) : []

  return (
    <div className="w-full space-y-3">
      {hasParts
        ? partsToRender.map((part, index) => renderMessagePart(part, index))
        : hasContent && <AssistantText content={message.content} />}
    </div>
  )
})
