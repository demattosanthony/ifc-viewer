import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { api } from "@/lib/api";
import { useEditor } from "@/features/editor/context";
import { useResizable } from "@/features/editor/hooks/use-resizable";
import { useFileOperations } from "../hooks/use-file-operations";
import { PanelLeft, Plus, FolderPlus, Upload } from "lucide-react";
import { FileTreeItem } from "./file-tree-item";
import { NewItemInput } from "./new-item-input";
import { DeleteDialog } from "./delete-dialog";

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size?: number;
  modifiedAt?: number;
}

interface FileBrowserProps {
  sessionId: string;
  visible?: boolean;
}

export interface FileBrowserHandle {
  refreshPath: (path: string) => void;
}

const MIN_WIDTH = 160;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 275;
const COLLAPSED_WIDTH = 48;

export const FileBrowser = forwardRef<FileBrowserHandle, FileBrowserProps>(
  function FileBrowser({ sessionId, visible = true }, ref) {
  const { openFile, closeTab, tabs } = useEditor();
  const [fileTree, setFileTree] = useState<Map<string, FileEntry[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["."]));
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [newItemType, setNewItemType] = useState<"file" | "folder" | null>(
    null
  );
  const [newItemParent, setNewItemParent] = useState<string>(".");
  const [newItemName, setNewItemName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    size: width,
    isCollapsed,
    expand,
    handleResizeStart,
  } = useResizable({
    initialSize: DEFAULT_WIDTH,
    minSize: MIN_WIDTH,
    maxSize: MAX_WIDTH,
    direction: "horizontal",
    collapseThreshold: MIN_WIDTH - 50,
  });

  const fetchFiles = useCallback(
    async (path: string, force = false) => {
      if (fileTree.has(path) && !force) return;
      setLoading((prev) => new Set(prev).add(path));
      try {
        const data = await api.sessions.files.listFiles({
          id: sessionId,
          path,
        });
        setFileTree((prev) => new Map(prev).set(path, data.files ?? []));
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

  const refreshFolder = useCallback(
    (path: string) => {
      fetchFiles(path, true);
    },
    [fetchFiles]
  );

  // Expose refresh method to parent via ref
  useImperativeHandle(ref, () => ({
    refreshPath: (path: string) => {
      // Get parent directory to refresh
      const parentPath = path.includes("/")
        ? path.substring(0, path.lastIndexOf("/")) || "."
        : ".";
      refreshFolder(parentPath);
    },
  }), [refreshFolder]);

  const {
    deleteTarget,
    uploadFiles,
    createItem,
    initiateDelete,
    confirmDelete,
    cancelDelete,
  } = useFileOperations({
    sessionId,
    onRefresh: refreshFolder,
  });

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

  const handleStartNewItem = useCallback(
    (type: "file" | "folder", parentPath: string) => {
      setNewItemType(type);
      setNewItemParent(parentPath);
      setNewItemName("");
      if (!expanded.has(parentPath)) {
        setExpanded((prev) => new Set(prev).add(parentPath));
        fetchFiles(parentPath);
      }
    },
    [expanded, fetchFiles]
  );

  const handleCreateItem = useCallback(async () => {
    if (!newItemName.trim() || !newItemType) return;
    const success = await createItem(newItemType, newItemParent, newItemName);
    if (success) {
      setNewItemType(null);
      setNewItemName("");
    }
  }, [newItemType, newItemParent, newItemName, createItem]);

  const handleCancelNewItem = useCallback(() => {
    setNewItemType(null);
    setNewItemName("");
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const tabToClose = tabs.find((t) => t.path === deleteTarget.path);
    await confirmDelete(() => {
      if (tabToClose) closeTab(tabToClose.id);
    });
  }, [deleteTarget, tabs, closeTab, confirmDelete]);

  const renderNewItemInput = (parentPath: string, depth: number) => {
    if (newItemType === null || newItemParent !== parentPath) return null;

    return (
      <NewItemInput
        type={newItemType}
        depth={depth}
        value={newItemName}
        onChange={setNewItemName}
        onSubmit={handleCreateItem}
        onCancel={handleCancelNewItem}
      />
    );
  };

  const renderTree = (path: string, depth: number = 0): React.ReactNode => {
    const files = fileTree.get(path);
    if (!files) return null;

    const sorted = [...files].sort((a, b) => {
      if (a.type === "directory" && b.type !== "directory") return -1;
      if (a.type !== "directory" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <>
        {path === newItemParent && renderNewItemInput(path, depth)}
        {sorted.map((file) => (
          <FileTreeItem
            key={file.path}
            file={file}
            depth={depth}
            isExpanded={expanded.has(file.path)}
            isLoading={loading.has(file.path)}
            onToggle={() => toggleFolder(file.path)}
            onClick={() => openFile(file.path)}
            onNewFile={(p) => handleStartNewItem("file", p)}
            onNewFolder={(p) => handleStartNewItem("folder", p)}
            onDelete={initiateDelete}
          >
            {renderTree(file.path, depth + 1)}
          </FileTreeItem>
        ))}
      </>
    );
  };

  if (!visible) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div className="relative flex" style={{ width: COLLAPSED_WIDTH }}>
        <div className="w-full bg-[#181818] border-r border-[#2d2d2d] flex flex-col items-center pt-2">
          <button
            onClick={() => expand()}
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
      <div className="flex-1 bg-background border-r border-[#2d2d2d] flex flex-col min-w-0">
        <div className="flex items-center justify-between px-2 h-[35px] border-b border-[#2d2d2d]">
          <span className="text-[11px] font-medium text-[#bbbbbb] uppercase tracking-wider">
            Explorer
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => handleStartNewItem("file", ".")}
              className="p-1 hover:bg-[#2d2d2d] rounded text-[#858585] hover:text-[#cccccc]"
              title="New File"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleStartNewItem("folder", ".")}
              className="p-1 hover:bg-[#2d2d2d] rounded text-[#858585] hover:text-[#cccccc]"
              title="New Folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 hover:bg-[#2d2d2d] rounded text-[#858585] hover:text-[#cccccc]"
              title="Upload Files"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                uploadFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
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

      <DeleteDialog
        target={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={cancelDelete}
      />
    </div>
  );
});
