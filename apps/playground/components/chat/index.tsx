"use client";

import { useState } from "react";
import { useAgent } from "@/lib/agent-context";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./message";
import { X, Trash2, ArrowUp, Square, MessageSquare } from "lucide-react";

interface ChatPanelProps {
  onClose?: () => void;
}

function ConnectionDot({ isConnected }: { isConnected: boolean }) {
  return (
    <div
      className={`h-1.5 w-1.5 rounded-full ${
        isConnected ? "bg-green-500" : "bg-red-500"
      }`}
      title={isConnected ? "Connected" : "Disconnected"}
    />
  );
}

function EmptyStateView({
  inputValue,
  setInputValue,
  isLoading,
  isConnected,
  onSubmit,
  onStop,
}: {
  inputValue: string;
  setInputValue: (value: string) => void;
  isLoading: boolean;
  isConnected: boolean;
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
          disabled={!isConnected}
          className="rounded-xl border border-border bg-secondary/30"
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
                disabled={!inputValue.trim() || !isConnected}
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
  const { messages, isLoading, isConnected, sendMessage, stop, clearMessages } =
    useAgent();
  const [inputValue, setInputValue] = useState("");

  const hasMessages = messages.length > 0;

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !isLoading && isConnected) {
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
            <ConnectionDot isConnected={isConnected} />
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
          isConnected={isConnected}
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
          <ConnectionDot isConnected={isConnected} />
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
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
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
          disabled={!isConnected}
          className="rounded-xl bg-secondary/50"
        >
          <PromptInputTextarea
            placeholder={!isConnected ? "Connecting..." : "Ask anything..."}
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
                  disabled={!inputValue.trim() || !isConnected}
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
