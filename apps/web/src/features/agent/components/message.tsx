import { memo } from "react";
import type { AgentMessage, MessagePart } from "@ifc-viewer/core";
import { Tool, type ToolPart } from "./tool";
import { Markdown } from "@ifc-viewer/ui/components";
import { FilePreview } from "./tool-views/file-preview";
import { CommandPreview } from "./tool-views/command-preview";
import { FileTree } from "./tool-views/file-tree";

interface ChatMessageProps {
  message: AgentMessage;
}

type ToolInvocation = NonNullable<AgentMessage["toolInvocations"]>[number];

// Type guard for tool results with success/error pattern
interface ToolResult {
  success?: boolean;
  error?: string;
}

function isToolResult(value: unknown): value is ToolResult {
  return (
    typeof value === "object" &&
    value !== null &&
    ("success" in value || "error" in value)
  );
}

function getToolState(invocation: ToolInvocation): {
  isStreaming: boolean;
  isComplete: boolean;
  error?: string;
} {
  const isStreaming = invocation.state === "streaming";
  const isComplete =
    invocation.state === "completed" || invocation.state === "error";

  let error: string | undefined;
  if (invocation.state === "error") {
    error = invocation.error;
  } else if (
    invocation.state === "completed" &&
    isToolResult(invocation.result)
  ) {
    if (invocation.result.success === false) {
      error = invocation.result.error || "Tool execution failed";
    }
  }

  return { isStreaming, isComplete, error };
}

function mapToolInvocationToToolPart(invocation: ToolInvocation): ToolPart {
  let state: ToolPart["state"];

  switch (invocation.state) {
    case "streaming":
      state = "streaming";
      break;
    case "pending":
    case "running":
      state = "input-streaming";
      break;
    case "completed": {
      const hasError =
        isToolResult(invocation.result) && invocation.result.success === false;
      state = hasError ? "output-error" : "output-available";
      break;
    }
    case "error":
      state = "output-error";
      break;
    case "needs-approval":
      state = "input-available";
      break;
    default:
      state = "input-streaming";
  }

  return {
    type: invocation.toolName,
    state,
    input: invocation.args as Record<string, unknown>,
    output: invocation.result as Record<string, unknown> | undefined,
    toolCallId: invocation.id,
    errorText: invocation.error,
  };
}

function ToolCard({ invocation }: { invocation: ToolInvocation }) {
  const { isStreaming, isComplete, error } = getToolState(invocation);
  const args = invocation.args as Record<string, unknown>;
  const result = invocation.result as Record<string, unknown> | undefined;

  // File tools (write/read)
  if (
    ["write_file", "writeFile", "read_file", "readFile"].includes(
      invocation.toolName
    )
  ) {
    const path = args?.path as string | undefined;
    const content = args?.content as string | undefined;

    if (path && content) {
      return (
        <FilePreview path={path} content={content} isStreaming={isStreaming} />
      );
    }
  }

  // Command tools
  if (["shell_execute", "executeCommand"].includes(invocation.toolName)) {
    const command = args?.command as string | undefined;

    if (command) {
      return (
        <CommandPreview
          command={command}
          output={result}
          isStreaming={isStreaming}
          isComplete={isComplete}
          error={error}
        />
      );
    }
  }

  // List directory tools
  if (["list_directory", "listFiles"].includes(invocation.toolName)) {
    const path = (args?.path as string) || ".";

    return <FileTree path={path} output={result} isComplete={isComplete} />;
  }

  // Fallback to generic Tool component
  return <Tool toolPart={mapToolInvocationToToolPart(invocation)} />;
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="rounded-xl bg-secondary/80 px-4 py-3 text-sm text-foreground">
      {content}
    </div>
  );
}

function AssistantText({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 leading-relaxed">
      <Markdown>{content}</Markdown>
    </div>
  );
}

function renderMessagePart(part: MessagePart, index: number) {
  if (part.type === "text") {
    return (
      <AssistantText
        key={`text-${part.stepIndex}-${index}`}
        content={part.content}
      />
    );
  }

  if (part.type === "tool") {
    return (
      <ToolCard
        key={`tool-${part.toolInvocation.id}`}
        invocation={part.toolInvocation}
      />
    );
  }

  return null;
}

export const ChatMessage = memo(function ChatMessage({
  message,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const hasParts = message.parts && message.parts.length > 0;
  const hasContent = message.content.trim().length > 0;
  const hasTools =
    message.toolInvocations && message.toolInvocations.length > 0;

  // Don't render empty assistant messages without tools or parts
  if (!isUser && !hasContent && !hasTools && !hasParts) {
    return null;
  }

  // User message - compact rounded box
  if (isUser) {
    return (
      <div className="w-full">
        <UserMessage content={message.content} />
      </div>
    );
  }

  // Assistant message - flowing text with inline tools
  return (
    <div className="w-full space-y-3">
      {hasParts ? (
        message.parts!.map((part, index) => renderMessagePart(part, index))
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
  );
});
