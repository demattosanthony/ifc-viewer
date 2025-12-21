import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/.bunbox/api-client";
import { useEditor } from "@/lib/editor-context";
import {
  ChevronRight,
  ChevronDown,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  FileBox,
  PanelLeft,
} from "lucide-react";

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size: number;
  modifiedAt: number;
}

interface FileBrowserProps {
  sessionId: string;
  visible?: boolean;
}

const MIN_WIDTH = 160;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 240;
const COLLAPSED_WIDTH = 48;

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "py":
      return <FileCode className="w-4 h-4 text-[#3572A5]" />;
    case "js":
    case "jsx":
      return <FileCode className="w-4 h-4 text-[#f7df1e]" />;
    case "ts":
    case "tsx":
      return <FileCode className="w-4 h-4 text-[#3178c6]" />;
    case "json":
      return <FileJson className="w-4 h-4 text-[#cbcb41]" />;
    case "md":
      return <FileText className="w-4 h-4 text-[#519aba]" />;
    case "ifc":
      return <FileBox className="w-4 h-4 text-[#6b9f78]" />;
    case "html":
    case "htm":
      return <FileCode className="w-4 h-4 text-[#e34c26]" />;
    case "css":
    case "scss":
      return <FileCode className="w-4 h-4 text-[#563d7c]" />;
    default:
      return <File className="w-4 h-4 text-[#858585]" />;
  }
}

export function FileBrowser({ sessionId, visible = true }: FileBrowserProps) {
  const { openFile } = useEditor();
  const [fileTree, setFileTree] = useState<Map<string, FileEntry[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["."]));
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const isDraggingRef = useRef(false);

  const fetchFiles = useCallback(
    async (path: string) => {
      if (fileTree.has(path)) return;
      setLoading((prev) => new Set(prev).add(path));
      try {
        const data = await api.sessions.files.listFiles({
          id: sessionId,
          path,
        });
        setFileTree((prev) => new Map(prev).set(path, data.files));
      } catch (err) {
        console.error("Error fetching files:", err);
      } finally {
        setLoading((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    },
    [sessionId, fileTree]
  );

  useEffect(() => {
    fetchFiles(".");
  }, []);

  const toggleFolder = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
        fetchFiles(path);
      }
      return next;
    });
  };

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        moveEvent.preventDefault();
        const delta = moveEvent.clientX - startX;
        const newWidth = startWidth + delta;

        if (newWidth < MIN_WIDTH - 50) {
          setCollapsed(true);
        } else {
          setCollapsed(false);
          setWidth(Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH)));
        }
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width]
  );

  const expand = () => {
    setCollapsed(false);
    setWidth(DEFAULT_WIDTH);
  };

  const renderTree = (path: string, depth: number = 0): React.ReactNode => {
    const files = fileTree.get(path);
    if (!files) return null;

    const sorted = [...files].sort((a, b) => {
      if (a.type === "directory" && b.type !== "directory") return -1;
      if (a.type !== "directory" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    });

    return sorted.map((file) => {
      const isDir = file.type === "directory";
      const isExpanded = expanded.has(file.path);
      const isLoading = loading.has(file.path);
      const indent = depth * 12;

      const handleClick = () => {
        if (isDir) {
          toggleFolder(file.path);
        } else {
          openFile(file.path);
        }
      };

      return (
        <div key={file.path}>
          <div
            onClick={handleClick}
            className="flex items-center h-[22px] hover:bg-[#2a2d2e] text-[#cccccc] cursor-pointer"
            style={{ paddingLeft: indent + 4 }}
          >
            {isDir ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[#858585] shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#858585] shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-[#dcb67a] shrink-0 ml-0.5" />
                ) : (
                  <Folder className="w-4 h-4 text-[#dcb67a] shrink-0 ml-0.5" />
                )}
              </>
            ) : (
              <>
                <span className="w-4 shrink-0" />
                <span className="ml-0.5">{getFileIcon(file.name)}</span>
              </>
            )}
            <span className="truncate select-none ml-1.5 text-[13px]">
              {file.name}
            </span>
          </div>
          {isDir &&
            isExpanded &&
            (isLoading ? (
              <div
                className="h-[22px] flex items-center text-[#858585] text-[13px]"
                style={{ paddingLeft: indent + 32 }}
              >
                loading...
              </div>
            ) : (
              renderTree(file.path, depth + 1)
            ))}
        </div>
      );
    });
  };

  if (!visible) {
    return null;
  }

  if (collapsed) {
    return (
      <div className="relative flex" style={{ width: COLLAPSED_WIDTH }}>
        <div className="w-full bg-[#181818] border-r border-[#2d2d2d] flex flex-col items-center pt-2">
          <button
            onClick={expand}
            className="p-2 hover:bg-[#2d2d2d] rounded text-[#858585] hover:text-[#cccccc] transition-colors"
            title="Explorer"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        </div>
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 right-0 bottom-0 w-1 cursor-ew-resize hover:bg-[#007acc] transition-colors"
        />
      </div>
    );
  }

  const rootFiles = fileTree.get(".");
  const isRootLoading = loading.has(".");

  return (
    <div className="relative flex" style={{ width }}>
      <div className="flex-1 bg-[#181818] border-r border-[#2d2d2d] flex flex-col min-w-0">
        <div className="flex items-center justify-between px-2 h-[35px] border-b border-[#2d2d2d]">
          <span className="text-[11px] font-medium text-[#bbbbbb] uppercase tracking-wider">
            Explorer
          </span>
        </div>

        <div className="flex-1 overflow-auto py-1">
          {isRootLoading && !rootFiles ? (
            <div className="px-4 py-1 text-[#858585] text-[13px]">
              Loading...
            </div>
          ) : rootFiles?.length === 0 ? (
            <div className="px-4 py-1 text-[#858585] text-[13px]">Empty</div>
          ) : (
            renderTree(".")
          )}
        </div>
      </div>

      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 right-0 bottom-0 w-1 cursor-ew-resize hover:bg-[#007acc] transition-colors"
      />
    </div>
  );
}
