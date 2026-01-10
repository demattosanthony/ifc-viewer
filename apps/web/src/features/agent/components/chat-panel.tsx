import type { ListConversationsResponse } from "@ifc-viewer/sdk"
import {
  Button,
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
  ErrorBoundary,
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
  PulseDotLoader,
} from "@ifc-viewer/ui/components"
import { ArrowUp, ChevronLeft, Plus, Square, Trash2, X } from "lucide-react"
import { useState } from "react"
import { useAgent } from "../context"
import { ChatMessage } from "./message"

/** Conversation type from API (derived from SDK) */
type Conversation = ListConversationsResponse[number]

interface ChatPanelProps {
  onClose?: () => void
}

/** Format relative time for conversation list */
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

/** Conversation list item - for empty state view */
function ConversationItem({
  conversation,
  onSelect,
  onDelete,
}: {
  conversation: Conversation
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className="group flex w-full cursor-pointer items-center justify-between rounded py-1 text-left transition-colors hover:text-foreground"
    >
      <span className="truncate text-sm text-muted-foreground group-hover:text-foreground">
        {conversation.title || "New conversation"}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {formatRelativeTime(new Date(conversation.updatedAt))}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          title="Delete conversation"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

function EmptyStateView({
  inputValue,
  setInputValue,
  isLoading,
  conversations,
  onSubmit,
  onStop,
  onSelectConversation,
  onDeleteConversation,
}: {
  inputValue: string
  setInputValue: (value: string) => void
  isLoading: boolean
  conversations: Conversation[]
  onSubmit: () => void
  onStop: () => void
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
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

      {/* Past chats at bottom */}
      {conversations.length > 0 && (
        <div className="border-t border-border/50 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Past Chats</span>
            {conversations.length > 5 && (
              <button className="text-sm text-muted-foreground hover:text-foreground">
                View All
              </button>
            )}
          </div>
          <div className="space-y-1">
            {conversations.slice(0, 5).map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                onSelect={() => onSelectConversation(conv.id)}
                onDelete={() => onDeleteConversation(conv.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const {
    messages,
    isLoading,
    conversationId,
    conversations,
    sendMessage,
    stop,
    clearMessages,
    deselectConversation,
    selectConversation,
    createNewConversation,
    deleteConversation,
  } = useAgent()
  const [inputValue, setInputValue] = useState("")

  const hasMessages = messages.length > 0

  // Show chat view if we have a conversation selected (even if messages are still loading)
  // This ensures the view switches immediately when selecting a conversation
  const showChatView = hasMessages || conversationId !== null

  // Check if we're waiting for the first token (loading but no content yet)
  const isAwaitingFirstToken = (() => {
    if (!isLoading) return false
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== "assistant") return false
    // Show loader if assistant message has no content and no tool invocations
    const hasContent = lastMessage.content.trim().length > 0
    const hasTools = lastMessage.toolInvocations && lastMessage.toolInvocations.length > 0
    return !hasContent && !hasTools
  })()

  // Check if conversation is selected but has no messages
  const hasNoMessages = conversationId !== null && !hasMessages && !isLoading

  const handleSubmit = () => {
    const trimmed = inputValue.trim()
    if (trimmed && !isLoading) {
      sendMessage(trimmed)
      setInputValue("")
    }
  }

  const handleNewConversation = () => {
    createNewConversation()
  }

  const handleBackToList = () => {
    // Go back to conversation list without deleting
    deselectConversation()
  }

  // Empty state - show conversation list
  if (!showChatView) {
    return (
      <div className="flex h-full flex-col border-l border-border bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Agent</span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewConversation}
              className="h-7 w-7"
              title="New conversation"
            >
              <Plus className="h-3.5 w-3.5" />
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

        <EmptyStateView
          inputValue={inputValue}
          setInputValue={setInputValue}
          isLoading={isLoading}
          conversations={conversations}
          onSubmit={handleSubmit}
          onStop={stop}
          onSelectConversation={selectConversation}
          onDeleteConversation={deleteConversation}
        />
      </div>
    )
  }

  // Active chat - input at bottom
  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      {/* Header with back button */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackToList}
            className="h-7 w-7"
            title="Back to conversations"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">
            {conversations.find((c) => c.id === conversationId)?.title || "New conversation"}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewConversation}
            className="h-7 w-7"
            title="New conversation"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearMessages}
            className="h-7 w-7"
            title="Delete conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7" title="Close">
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
          {hasNoMessages && <div className="text-sm text-muted-foreground">No messages</div>}
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
          <PromptInputTextarea placeholder="Ask anything..." className="min-h-[40px] text-sm" />
          <PromptInputActions className="justify-end px-2 pb-2">
            {isLoading ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                onClick={stop}
                title="Stop"
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-7 w-7 rounded-lg"
                disabled={!inputValue.trim()}
                onClick={handleSubmit}
                title="Send"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
            )}
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  )
}
