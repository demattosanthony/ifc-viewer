import { useEditor, type Tab } from "@/lib/editor-context";
import { X, FileCode, FileBox } from "lucide-react";

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

  const ext = name.split(".").pop()?.toLowerCase();
  let color = "#858585";

  switch (ext) {
    case "py":
      color = "#3572A5";
      break;
    case "js":
    case "jsx":
      color = "#f7df1e";
      break;
    case "ts":
    case "tsx":
      color = "#3178c6";
      break;
    case "json":
      color = "#cbcb41";
      break;
    case "html":
      color = "#e34c26";
      break;
    case "css":
      color = "#563d7c";
      break;
  }

  return <FileCode className="w-4 h-4 shrink-0" style={{ color }} />;
}

interface TabBarProps {
  showSidebar: boolean;
  showTerminal: boolean;
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
}

export function TabBar({ showSidebar, showTerminal, onToggleSidebar, onToggleTerminal }: TabBarProps) {
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
              <span className="text-[13px] select-none whitespace-nowrap">{tab.name}</span>
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
      </div>
    </div>
  );
}
