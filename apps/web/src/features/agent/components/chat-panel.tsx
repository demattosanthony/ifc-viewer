import type { ListConversationsResponse } from "@ifc-viewer/sdk"
import {
  Button,
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
  ErrorBoundary,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
  TextShimmer,
} from "@ifc-viewer/ui/components"
import { ArrowUp, ChevronLeft, MoreHorizontal, Square, Trash2, X } from "lucide-react"
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
  const [menuOpen, setMenuOpen] = useState(false)

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
      className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent data-[menu-open=true]:bg-accent"
      data-menu-open={menuOpen}
    >
      {/* Title */}
      <span className="flex-1 truncate text-sm text-muted-foreground group-hover:text-foreground group-data-[menu-open=true]:text-foreground">
        {conversation.title || "New conversation"}
      </span>

      {/* Right side: time (default) or ellipsis menu (on hover/menu open) */}
      <span className="text-xs text-muted-foreground group-hover:hidden group-data-[menu-open=true]:hidden">
        {formatRelativeTime(new Date(conversation.updatedAt))}
      </span>

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent-foreground/10 hover:text-foreground group-hover:flex group-data-[menu-open=true]:flex"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-32 p-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
              setMenuOpen(false)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </PopoverContent>
      </Popover>
    </div>
  )
}

const CONVERSATIONS_PER_PAGE = 5

function EmptyStateView({
  inputValue,
  setInputValue,
  conversations,
  onSubmit,
  onSelectConversation,
  onDeleteConversation,
}: {
  inputValue: string
  setInputValue: (value: string) => void
  conversations: Conversation[]
  onSubmit: () => void
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
}) {
  const [visibleCount, setVisibleCount] = useState(CONVERSATIONS_PER_PAGE)
  const visibleConversations = conversations.slice(0, visibleCount)
  const hasMore = conversations.length > visibleCount

  return (
    <div className="flex h-full flex-col">
      {/* Top section with input + conversations list */}
      <div className="p-4">
        <PromptInput
          value={inputValue}
          onValueChange={setInputValue}
          onSubmit={onSubmit}
          className="rounded-xl border border-border bg-input"
        >
          <PromptInputTextarea
            placeholder="Ask anything..."
            className="min-h-[80px] resize-none text-sm"
            autoFocus
          />
          <PromptInputActions className="justify-end px-3 pb-3">
            <Button
              size="icon"
              className="h-7 w-7 rounded-lg bg-foreground text-background hover:bg-foreground/90"
              disabled={!inputValue.trim()}
              onClick={onSubmit}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
          </PromptInputActions>
        </PromptInput>

        {/* Past conversations - directly under input */}
        {conversations.length > 0 && (
          <div className="mt-4">
            <div className="mb-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recent
              </span>
            </div>
            <div className="space-y-0.5">
              {visibleConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  onSelect={() => onSelectConversation(conv.id)}
                  onDelete={() => onDeleteConversation(conv.id)}
                />
              ))}
            </div>
            {hasMore && (
              <button
                type="button"
                className="mt-2 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setVisibleCount((prev) => prev + CONVERSATIONS_PER_PAGE)}
              >
                See more
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty space at bottom */}
      <div className="flex-1" />
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
    deselectConversation,
    selectConversation,
    deleteConversation,
  } = useAgent()
  // Separate input states for empty state and chat view
  const [emptyStateInput, setEmptyStateInput] = useState("")
  const [chatInput, setChatInput] = useState("")

  const hasMessages = messages.length > 0

  // Show chat view if we have a conversation selected (even if messages are still loading)
  // This ensures the view switches immediately when selecting a conversation
  const showChatView = hasMessages || conversationId !== null

  // Check if we're waiting for the first token (loading but no content yet)
  const isAwaitingFirstToken = (() => {
    if (!isLoading) return false
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== "assistant") return false
    // Show loader if assistant message has no content, tool parts, or reasoning parts
    const hasContent = lastMessage.content.trim().length > 0
    const hasToolParts = lastMessage.parts?.some((p) => p.type === "tool-use") ?? false
    const hasReasoningParts = lastMessage.parts?.some((p) => p.type === "reasoning") ?? false
    return !hasContent && !hasToolParts && !hasReasoningParts
  })()

  // Check if conversation is selected but has no messages
  const hasNoMessages = conversationId !== null && !hasMessages && !isLoading

  const handleEmptyStateSubmit = () => {
    const trimmed = emptyStateInput.trim()
    if (trimmed && !isLoading) {
      sendMessage(trimmed)
      setEmptyStateInput("")
    }
  }

  const handleChatSubmit = () => {
    const trimmed = chatInput.trim()
    if (trimmed && !isLoading) {
      sendMessage(trimmed)
      setChatInput("")
    }
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
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7" title="Close">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <EmptyStateView
          inputValue={emptyStateInput}
          setInputValue={setEmptyStateInput}
          conversations={conversations}
          onSubmit={handleEmptyStateSubmit}
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

        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7" title="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
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
            <div className="flex items-center gap-2">
              <TextShimmer duration={1.5} className="text-sm">
                Thinking...
              </TextShimmer>
            </div>
          )}
          {hasNoMessages && <div className="text-sm text-muted-foreground">No messages</div>}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      {/* Input */}
      <div className="border-t border-border p-3">
        <PromptInput
          value={chatInput}
          onValueChange={setChatInput}
          isLoading={isLoading}
          onSubmit={handleChatSubmit}
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
                className="h-7 w-7 rounded-lg bg-foreground text-background hover:bg-foreground/90"
                disabled={!chatInput.trim()}
                onClick={handleChatSubmit}
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
