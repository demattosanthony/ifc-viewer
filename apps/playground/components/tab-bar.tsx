import { useEditor, type Tab } from "@/lib/editor-context";
import { FileIcon } from "@/lib/file-icons";
import { X, FileBox } from "lucide-react";

function SidebarIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1" />
      <rect
        x="1.5"
        y="1.5"
        width="4"
        height="13"
        rx="1"
        fill={active ? "currentColor" : "none"}
      />
      <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" />
    </svg>
  );
}

function RightSidebarIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1" />
      <rect
        x="10.5"
        y="1.5"
        width="4"
        height="13"
        rx="1"
        fill={active ? "currentColor" : "none"}
      />
      <line x1="10.5" y1="1.5" x2="10.5" y2="14.5" />
    </svg>
  );
}

function TerminalIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1" />
      <rect
        x="1.5"
        y="9.5"
        width="13"
        height="5"
        rx="1"
        fill={active ? "currentColor" : "none"}
      />
      <line x1="1.5" y1="9.5" x2="14.5" y2="9.5" />
    </svg>
  );
}

function TabIcon({ type, name }: { type: Tab["type"]; name: string }) {
  if (type === "ifc") {
    return <FileBox className="w-4 h-4 text-[#6b9f78] shrink-0" />;
  }

  return <FileIcon filename={name} className="w-4 h-4 shrink-0" />;
}

interface TabBarProps {
  showSidebar: boolean;
  showTerminal: boolean;
  showChat: boolean;
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
  onToggleChat: () => void;
}

export function TabBar({ showSidebar, showTerminal, showChat, onToggleSidebar, onToggleTerminal, onToggleChat }: TabBarProps) {
  const { tabs, activeTabId, setActiveTab, closeTab } = useEditor();

  return (
    <div className="h-[35px] bg-[#181818] border-b border-[#2d2d2d] flex items-center">
      {/* Tabs */}
      <div className="flex-1 flex items-end h-full overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center gap-2 h-[35px] px-3 cursor-pointer border-r border-[#2d2d2d] ${
                isActive
                  ? "bg-[#1e1e1e] text-[#ffffff]"
                  : "bg-[#2d2d2d] text-[#969696] hover:bg-[#2a2a2a]"
              }`}
            >
              <TabIcon type={tab.type} name={tab.name} />
              <span className="text-[13px] select-none whitespace-nowrap flex items-center gap-1">
                {tab.name}
                {tab.isDirty && (
                  <span className="w-2 h-2 rounded-full bg-[#cccccc]" title="Unsaved changes" />
                )}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={`p-0.5 rounded hover:bg-[#3d3d3d] ${
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Layout Controls */}
      <div className="flex items-center gap-0.5 px-2">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded text-[#858585] hover:text-[#cccccc] hover:bg-[#2d2d2d] transition-colors"
          title="Toggle Sidebar"
        >
          <SidebarIcon active={showSidebar} />
        </button>
        <button
          onClick={onToggleTerminal}
          className="p-1.5 rounded text-[#858585] hover:text-[#cccccc] hover:bg-[#2d2d2d] transition-colors"
          title="Toggle Terminal"
        >
          <TerminalIcon active={showTerminal} />
        </button>
        <button
          onClick={onToggleChat}
          className="p-1.5 rounded text-[#858585] hover:text-[#cccccc] hover:bg-[#2d2d2d] transition-colors"
          title="Toggle Chat"
        >
          <RightSidebarIcon active={showChat} />
        </button>
      </div>
    </div>
  );
}
