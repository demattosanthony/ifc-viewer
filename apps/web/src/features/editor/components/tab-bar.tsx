import { Plus, X } from "lucide-react"
import { FileIcon } from "@/shared/components/file-icons/file-icon"
import { useEditor } from "../context"

function LeftSidebarIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="1.5" y="1.5" width="13" height="13" rx="1" />
      <rect x="1.5" y="1.5" width="4" height="13" rx="1" fill={active ? "currentColor" : "none"} />
      <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" />
    </svg>
  )
}

function RightSidebarIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="1.5" y="1.5" width="13" height="13" rx="1" />
      <rect x="10.5" y="1.5" width="4" height="13" rx="1" fill={active ? "currentColor" : "none"} />
      <line x1="10.5" y1="1.5" x2="10.5" y2="14.5" />
    </svg>
  )
}

function TerminalIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="1.5" y="1.5" width="13" height="13" rx="1" />
      <rect x="1.5" y="9.5" width="13" height="5" rx="1" fill={active ? "currentColor" : "none"} />
      <line x1="1.5" y1="9.5" x2="14.5" y2="9.5" />
    </svg>
  )
}

function TabIcon({ path }: { path: string }) {
  return <FileIcon node={{ path, type: "file" }} className="shrink-0" />
}

interface TabBarProps {
  showSidebar: boolean
  showTerminal: boolean
  showChat: boolean
  onToggleSidebar: () => void
  onToggleTerminal: () => void
  onToggleChat: () => void
  onAddTab: () => void
}

export function TabBar({
  showSidebar,
  showTerminal,
  showChat,
  onToggleSidebar,
  onToggleTerminal,
  onToggleChat,
  onAddTab,
}: TabBarProps) {
  const { tabs, activeTabId, setActiveTab, closeTab } = useEditor()

  // Check if Models tab is active (no activeTabId means Models view is shown)
  const isModelsActive = activeTabId === null

  return (
    <div className="h-[35px] bg-secondary border-b border-border flex items-center">
      {/* Pinned Models Tab */}
      <div
        onClick={() => setActiveTab(null)}
        className={`flex items-center gap-2 h-full px-3 cursor-pointer border-r border-border shrink-0 ${
          isModelsActive
            ? "bg-background text-foreground"
            : "bg-muted text-muted-foreground hover:bg-accent/50"
        }`}
      >
        <FileIcon node={{ path: "models.ifc", type: "file" }} className="shrink-0" />
        <span className="text-[13px] select-none">Models</span>
      </div>

      {/* Dynamic Tabs */}
      <div className="flex-1 flex items-center h-full overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center gap-2 h-full px-3 cursor-pointer border-r border-border shrink-0 ${
                isActive
                  ? "bg-background text-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent/50"
              }`}
            >
              <TabIcon path={tab.path} />
              <span className="text-[13px] select-none whitespace-nowrap flex items-center gap-1">
                {tab.name}
                {tab.isDirty && (
                  <span
                    className="w-2 h-2 rounded-full bg-muted-foreground"
                    title="Unsaved changes"
                  />
                )}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                className={`p-0.5 rounded hover:bg-accent ${
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Add Tab Button */}
      <button
        onClick={onAddTab}
        className="p-1.5 mx-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Open File"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Layout Controls */}
      <div className="flex items-center gap-0.5 px-2 border-l border-border">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Toggle File Browser"
        >
          <LeftSidebarIcon active={showSidebar} />
        </button>
        <button
          onClick={onToggleTerminal}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Toggle Terminal"
        >
          <TerminalIcon active={showTerminal} />
        </button>
        <button
          onClick={onToggleChat}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Toggle Chat"
        >
          <RightSidebarIcon active={showChat} />
        </button>
      </div>
    </div>
  )
}
