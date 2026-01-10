import type { AgentMessage, MessagePart } from "@ifc-viewer/core"
import { Markdown } from "@ifc-viewer/ui/components"
import { memo } from "react"
import { Tool, type ToolPart } from "./tool"
import { CommandPreview } from "./tool-views/command-preview"
import { FilePreview } from "./tool-views/file-preview"
import { PythonPreview } from "./tool-views/python-preview"
import { ReadFilePreview } from "./tool-views/read-file-preview"

interface ChatMessageProps {
  message: AgentMessage
}

type ToolInvocation = NonNullable<AgentMessage["toolInvocations"]>[number]

// Type guard for tool results with success/error pattern
interface ToolResult {
  success?: boolean
  error?: string
}

function isToolResult(value: unknown): value is ToolResult {
  return typeof value === "object" && value !== null && ("success" in value || "error" in value)
}

function getToolState(invocation: ToolInvocation): {
  isStreaming: boolean
  isComplete: boolean
  error?: string
} {
  const isStreaming = invocation.state === "streaming"
  const isComplete = invocation.state === "completed" || invocation.state === "error"

  let error: string | undefined
  if (invocation.state === "error") {
    error = invocation.error
  } else if (invocation.state === "completed" && isToolResult(invocation.result)) {
    if (invocation.result.success === false) {
      error = invocation.result.error || "Tool execution failed"
    }
  }

  return { isStreaming, isComplete, error }
}

function mapToolInvocationToToolPart(invocation: ToolInvocation): ToolPart {
  let state: ToolPart["state"]

  switch (invocation.state) {
    case "streaming":
      state = "streaming"
      break
    case "pending":
    case "running":
      state = "input-streaming"
      break
    case "completed": {
      const hasError = isToolResult(invocation.result) && invocation.result.success === false
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
    type: invocation.toolName,
    state,
    input: invocation.args as Record<string, unknown>,
    output: invocation.result as Record<string, unknown> | undefined,
    toolCallId: invocation.id,
    errorText: invocation.error,
  }
}

function ToolCard({ invocation }: { invocation: ToolInvocation }) {
  const { isStreaming, isComplete, error } = getToolState(invocation)
  const args = invocation.args as Record<string, unknown>
  const result = invocation.result as Record<string, unknown> | undefined

  // Write file tool - content is in args
  if (["write_file", "writeFile"].includes(invocation.toolName)) {
    const path = args?.path as string | undefined
    const content = args?.content as string | undefined

    if (path && content) {
      return <FilePreview path={path} content={content} isStreaming={isStreaming} />
    }
  }

  // Read file tool - content is in result
  if (["read_file", "readFile"].includes(invocation.toolName)) {
    const path = args?.path as string | undefined

    if (path) {
      return (
        <ReadFilePreview
          path={path}
          result={result as { success?: boolean; content?: string; error?: string } | undefined}
          isStreaming={isStreaming}
          isComplete={isComplete}
        />
      )
    }
  }

  // Command tools
  if (["shell_execute", "executeCommand"].includes(invocation.toolName)) {
    const command = args?.command as string | undefined
    const title = args?.title as string | undefined

    if (command) {
      return (
        <CommandPreview
          title={title}
          command={command}
          output={result}
          isStreaming={isStreaming}
          isComplete={isComplete}
          error={error}
        />
      )
    }
  }

  // Python execution tool
  if (invocation.toolName === "executePython") {
    const code = args?.code as string | undefined
    const title = args?.title as string | undefined

    if (code) {
      return (
        <PythonPreview
          title={title}
          code={code}
          output={result}
          isStreaming={isStreaming}
          isComplete={isComplete}
          error={error}
        />
      )
    }
  }

  // Fallback to generic Tool component
  return <Tool toolPart={mapToolInvocationToToolPart(invocation)} />
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
function mergeConsecutiveTextParts(parts: MessagePart[]): MessagePart[] {
  const merged: MessagePart[] = []

  for (const part of parts) {
    const last = merged[merged.length - 1]

    if (part.type === "text" && last?.type === "text") {
      // Merge with previous text part
      merged[merged.length - 1] = {
        ...last,
        content: last.content + part.content,
      }
    } else {
      merged.push(part)
    }
  }

  return merged
}

function renderMessagePart(part: MessagePart, index: number) {
  if (part.type === "text") {
    return <AssistantText key={`text-${index}`} content={part.content} />
  }

  if (part.type === "tool") {
    return <ToolCard key={`tool-${part.toolInvocation.id}`} invocation={part.toolInvocation} />
  }

  return null
}

export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"
  const hasParts = message.parts && message.parts.length > 0
  const hasContent = message.content.trim().length > 0
  const hasTools = message.toolInvocations && message.toolInvocations.length > 0

  // Don't render empty assistant messages without tools or parts
  if (!isUser && !hasContent && !hasTools && !hasParts) {
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
      {hasParts ? (
        partsToRender.map((part, index) => renderMessagePart(part, index))
      ) : (
        <>
          {hasContent && <AssistantText content={message.content} />}
          {hasTools && (
            <div className="space-y-2">
              {message.toolInvocations!.map((invocation) => (
                <ToolCard key={invocation.id} invocation={invocation} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
})
