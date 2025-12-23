"use client";

import { memo } from "react";
import type { AgentMessage, MessagePart } from "@ifc-viewer/agent";
import { Tool, type ToolPart } from "@/components/ui/tool";
import { Markdown } from "@/components/ui/markdown";

interface ChatMessageProps {
  message: AgentMessage;
}

function mapToolInvocationToToolPart(
  invocation: NonNullable<AgentMessage["toolInvocations"]>[number]
): ToolPart {
  let state: ToolPart["state"];

  switch (invocation.state) {
    case "pending":
    case "running":
      state = "input-streaming";
      break;
    case "completed":
      const result = invocation.result as { success?: boolean } | undefined;
      state = result?.success === false ? "output-error" : "output-available";
      break;
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
    <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground">
      <Markdown>{content}</Markdown>
    </div>
  );
}

function ToolCard({
  invocation,
}: {
  invocation: NonNullable<AgentMessage["toolInvocations"]>[number];
}) {
  return (
    <Tool toolPart={mapToolInvocationToToolPart(invocation)} className="my-2" />
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
    <div className="w-full space-y-2">
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
