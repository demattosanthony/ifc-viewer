import { useState } from "react";
import { useAgent } from "../context";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@ifc-viewer/ui/components";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@ifc-viewer/ui/components";
import { Button } from "@ifc-viewer/ui/components";
import { ErrorBoundary } from "@ifc-viewer/ui/components";
import { ChatMessage } from "./message";
import { PulseDotLoader } from "@ifc-viewer/ui/components";
import { X, Trash2, ArrowUp, Square, MessageSquare } from "lucide-react";

interface ChatPanelProps {
  onClose?: () => void;
}

function EmptyStateView({
  inputValue,
  setInputValue,
  isLoading,
  onSubmit,
  onStop,
}: {
  inputValue: string;
  setInputValue: (value: string) => void;
  isLoading: boolean;
  onSubmit: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Top input area */}
      <div className="p-4">
        <PromptInput
          value={inputValue}
          onValueChange={setInputValue}
          isLoading={isLoading}
          onSubmit={onSubmit}
          className="rounded-xl border border-border bg-input"
        >
          <PromptInputTextarea
            placeholder="Ask anything..."
            className="min-h-[80px] resize-none text-sm"
          />
          <PromptInputActions className="justify-end px-3 pb-3">
            {isLoading ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                onClick={onStop}
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-7 w-7 rounded-lg"
                disabled={!inputValue.trim()}
                onClick={onSubmit}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
            )}
          </PromptInputActions>
        </PromptInput>
      </div>

      {/* Empty space */}
      <div className="flex-1" />

      {/* Bottom quick actions */}
      <div className="border-t border-border/50 p-4">
        <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Quick Actions</span>
        </div>
        <div className="space-y-1">
          {[
            "Create a Python script",
            "List files in project",
            "Explain this codebase",
          ].map((hint) => (
            <button
              key={hint}
              onClick={() => setInputValue(hint)}
              className="block w-full rounded px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
            >
              {hint}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const { messages, isLoading, sendMessage, stop, clearMessages } = useAgent();
  const [inputValue, setInputValue] = useState("");

  const hasMessages = messages.length > 0;

  // Check if we're waiting for the first token (loading but no content yet)
  const isAwaitingFirstToken = (() => {
    if (!isLoading) return false;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return false;
    // Show loader if assistant message has no content and no tool invocations
    const hasContent = lastMessage.content.trim().length > 0;
    const hasTools =
      lastMessage.toolInvocations && lastMessage.toolInvocations.length > 0;
    return !hasContent && !hasTools;
  })();

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !isLoading) {
      sendMessage(trimmed);
      setInputValue("");
    }
  };

  // Empty state - input at top like Cursor
  if (!hasMessages) {
    return (
      <div className="flex h-full flex-col border-l border-border bg-background">
        {/* Minimal Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Agent</span>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <EmptyStateView
          inputValue={inputValue}
          setInputValue={setInputValue}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onStop={stop}
        />
      </div>
    );
  }

  // Active chat - input at bottom
  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      {/* Minimal Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Agent</span>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={clearMessages}
            className="h-7 w-7"
            title="Clear"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ChatContainerRoot className="flex-1">
        <ChatContainerContent className="space-y-4 p-4">
          <ErrorBoundary
            fallback={
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                Failed to render messages. Try clearing the chat.
              </div>
            }
          >
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </ErrorBoundary>
          {isAwaitingFirstToken && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <PulseDotLoader />
            </div>
          )}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      {/* Input */}
      <div className="border-t border-border p-3">
        <PromptInput
          value={inputValue}
          onValueChange={setInputValue}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          className="rounded-xl bg-input"
        >
          <PromptInputTextarea
            placeholder="Ask anything..."
            className="min-h-[40px] text-sm"
          />
          <PromptInputActions className="justify-end px-2 pb-2">
            {isLoading ? (
              <PromptInputAction tooltip="Stop">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                  onClick={stop}
                >
                  <Square className="h-3.5 w-3.5" />
                </Button>
              </PromptInputAction>
            ) : (
              <PromptInputAction tooltip="Send">
                <Button
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  disabled={!inputValue.trim()}
                  onClick={handleSubmit}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              </PromptInputAction>
            )}
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}
