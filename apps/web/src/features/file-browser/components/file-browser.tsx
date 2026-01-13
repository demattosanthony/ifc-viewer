import { type ListProjectFilesResponse, listProjectFiles } from "@ifc-viewer/sdk"
import { listProjectFilesQueryKey } from "@ifc-viewer/sdk/hooks"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { FolderPlus, PanelLeft, Plus, Upload } from "lucide-react"
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { useEditor } from "@/features/editor/context"
import { useResizable } from "@/features/editor/hooks/use-resizable"
import { ModeSwitch } from "@/shared/components/mode-switch"
import { useFileOperations } from "../hooks/use-file-operations"
import { DeleteDialog } from "./delete-dialog"
import { FileTreeItem } from "./file-tree-item"
import { NewItemInput } from "./new-item-input"

type FileEntry = ListProjectFilesResponse["files"][number]

interface FileBrowserProps {
  projectId: string
  visible?: boolean
}

export interface FileBrowserHandle {
  refreshPath: (path: string) => void
}

const MIN_WIDTH = 200
const MAX_WIDTH = 450
const DEFAULT_WIDTH = 280
const COLLAPSED_WIDTH = 48

export const FileBrowser = forwardRef<FileBrowserHandle, FileBrowserProps>(function FileBrowser(
  { projectId, visible = true },
  ref
) {
  const queryClient = useQueryClient()
  const { openFile, closeTab, tabs } = useEditor()
  const [fileTree, setFileTree] = useState<Map<string, FileEntry[]>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["."]))
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set())
  const [newItemType, setNewItemType] = useState<"file" | "folder" | null>(null)
  const [newItemParent, setNewItemParent] = useState<string>(".")
  const [newItemName, setNewItemName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    storageKey: "ifc-viewer:left-sidebar-width",
    collapseThreshold: MIN_WIDTH - 50,
  })

  // Query for root files
  const rootFilesQuery = useQuery({
    queryKey: listProjectFilesQueryKey({
      path: { id: projectId },
      query: { path: "." },
    }),
    queryFn: async () => {
      const { data } = await listProjectFiles({
        path: { id: projectId },
        query: { path: "." },
      })
      return data!
    },
    staleTime: 30000,
  })

  // Update file tree when root files are fetched
  useEffect(() => {
    if (rootFilesQuery.data?.files) {
      setFileTree((prev) => new Map(prev).set(".", rootFilesQuery.data.files))
    }
  }, [rootFilesQuery.data])

  const fetchFiles = useCallback(
    async (path: string, force = false) => {
      if (fileTree.has(path) && !force) return

      setLoadingPaths((prev) => new Set(prev).add(path))
      try {
        const { data } = await listProjectFiles({
          path: { id: projectId },
          query: { path },
        })
        setFileTree((prev) => new Map(prev).set(path, data?.files ?? []))
      } catch (err) {
        console.error("Error fetching files:", err)
      } finally {
        setLoadingPaths((prev) => {
          const next = new Set(prev)
          next.delete(path)
          return next
        })
      }
    },
    [projectId, fileTree]
  )

  const refreshFolder = useCallback(
    (path: string) => {
      // Invalidate the query cache for this path
      queryClient.invalidateQueries({
        queryKey: listProjectFilesQueryKey({
          path: { id: projectId },
          query: { path },
        }),
      })
      // Also refetch directly
      fetchFiles(path, true)
    },
    [fetchFiles, queryClient, projectId]
  )

  // Expose refresh method to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      refreshPath: (path: string) => {
        // Get parent directory to refresh
        const parentPath = path.includes("/")
          ? path.substring(0, path.lastIndexOf("/")) || "."
          : "."
        refreshFolder(parentPath)
      },
    }),
    [refreshFolder]
  )

  const { deleteTarget, uploadFiles, createItem, initiateDelete, confirmDelete, cancelDelete } =
    useFileOperations({
      projectId,
      onRefresh: refreshFolder,
    })

  const toggleFolder = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
        fetchFiles(path)
      }
      return next
    })
  }

  const handleStartNewItem = useCallback(
    (type: "file" | "folder", parentPath: string) => {
      setNewItemType(type)
      setNewItemParent(parentPath)
      setNewItemName("")
      if (!expanded.has(parentPath)) {
        setExpanded((prev) => new Set(prev).add(parentPath))
        fetchFiles(parentPath)
      }
    },
    [expanded, fetchFiles]
  )

  const handleCreateItem = useCallback(async () => {
    if (!newItemName.trim() || !newItemType) return
    const success = await createItem(newItemType, newItemParent, newItemName)
    if (success) {
      setNewItemType(null)
      setNewItemName("")
    }
  }, [newItemType, newItemParent, newItemName, createItem])

  const handleCancelNewItem = useCallback(() => {
    setNewItemType(null)
    setNewItemName("")
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    const tabToClose = tabs.find((t) => t.path === deleteTarget.path)
    await confirmDelete(() => {
      if (tabToClose) closeTab(tabToClose.id)
    })
  }, [deleteTarget, tabs, closeTab, confirmDelete])

  const renderNewItemInput = (parentPath: string, depth: number) => {
    if (newItemType === null || newItemParent !== parentPath) return null

    return (
      <NewItemInput
        type={newItemType}
        depth={depth}
        value={newItemName}
        onChange={setNewItemName}
        onSubmit={handleCreateItem}
        onCancel={handleCancelNewItem}
      />
    )
  }

  const renderTree = (path: string, depth: number = 0): React.ReactNode => {
    const files = fileTree.get(path)
    if (!files) return null

    const sorted = [...files].sort((a, b) => {
      if (a.type === "directory" && b.type !== "directory") return -1
      if (a.type !== "directory" && b.type === "directory") return 1
      return a.name.localeCompare(b.name)
    })

    return (
      <>
        {path === newItemParent && renderNewItemInput(path, depth)}
        {sorted.map((file) => (
          <FileTreeItem
            key={file.path}
            file={file}
            depth={depth}
            isExpanded={expanded.has(file.path)}
            isLoading={loadingPaths.has(file.path)}
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
    )
  }

  if (!visible) {
    return null
  }

  if (isCollapsed) {
    return (
      <div className="relative flex" style={{ width: COLLAPSED_WIDTH }}>
        <div className="w-full bg-secondary border-r border-border flex flex-col items-center pt-2">
          <button
            onClick={() => expand()}
            className="p-2 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Explorer"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        </div>
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 right-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary transition-colors"
        />
      </div>
    )
  }

  const rootFiles = fileTree.get(".")
  const isRootLoading = rootFilesQuery.isLoading

  return (
    <div className="relative flex" style={{ width }}>
      <div className="flex-1 bg-background border-r border-border flex flex-col min-w-0">
        <div className="flex items-center justify-between px-2 h-[41px] border-b border-border">
          <ModeSwitch />
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => handleStartNewItem("file", ".")}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
              title="New File"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleStartNewItem("folder", ".")}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
              title="New Folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
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
                uploadFiles(e.target.files)
                e.target.value = ""
              }
            }}
          />
        </div>

        <div className="flex-1 overflow-auto py-1">
          {isRootLoading && !rootFiles ? (
            <div className="px-4 py-1 text-muted-foreground text-[13px]">Loading...</div>
          ) : rootFiles?.length === 0 ? (
            <div className="px-4 py-1 text-muted-foreground text-[13px]">Empty</div>
          ) : (
            renderTree(".")
          )}
        </div>
      </div>

      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 right-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary transition-colors"
      />

      <DeleteDialog target={deleteTarget} onConfirm={handleDeleteConfirm} onCancel={cancelDelete} />
    </div>
  )
})
