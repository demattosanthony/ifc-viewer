import type { ListProjectFilesResponse } from "@ifc-viewer/sdk"
import { listProjectFiles } from "@ifc-viewer/sdk"
import { listProjectFilesQueryKey } from "@ifc-viewer/sdk/hooks"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@ifc-viewer/ui/components/dialog"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronRight, Search } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { FileIcon } from "@/shared/components/file-icons/file-icon"

type FileEntry = ListProjectFilesResponse["files"][number]

interface FilePickerModalProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileSelect: (path: string) => void
}

interface FileTreeItemProps {
  file: FileEntry
  depth: number
  isExpanded: boolean
  onToggle: () => void
  onSelect: () => void
  children?: React.ReactNode
}

function PickerFileTreeItem({
  file,
  depth,
  isExpanded,
  onToggle,
  onSelect,
  children,
}: FileTreeItemProps) {
  const isDir = file.type === "directory"
  const indent = depth * 16

  const handleClick = () => {
    if (isDir) {
      onToggle()
    } else {
      onSelect()
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className="w-full flex items-center h-9 hover:bg-accent/50 text-foreground rounded-sm transition-colors"
        style={{ paddingLeft: indent + 12 }}
      >
        {isDir ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <FileIcon
              node={{ path: file.path, type: "directory" }}
              expanded={isExpanded}
              className="ml-1"
            />
          </>
        ) : (
          <>
            <span className="w-4 shrink-0" />
            <FileIcon node={{ path: file.path, type: "file" }} className="ml-1" />
          </>
        )}
        <span className="truncate select-none ml-2 text-sm">{file.name}</span>
      </button>

      {isDir && isExpanded && children}
    </div>
  )
}

export function FilePickerModal({
  projectId,
  open,
  onOpenChange,
  onFileSelect,
}: FilePickerModalProps) {
  const [fileTree, setFileTree] = useState<Map<string, FileEntry[]>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["."]))
  const [searchQuery, setSearchQuery] = useState("")

  // Query for root files
  const rootFilesQuery = useQuery({
    queryKey: listProjectFilesQueryKey({
      path: { id: projectId },
      query: { path: ".", hideDotfiles: true },
    }),
    queryFn: async () => {
      const { data } = await listProjectFiles({
        path: { id: projectId },
        query: { path: ".", hideDotfiles: true },
      })
      return data!
    },
    staleTime: 30000,
    enabled: open,
  })

  // Update file tree when root files are fetched
  useEffect(() => {
    if (rootFilesQuery.data?.files) {
      setFileTree((prev) => new Map(prev).set(".", rootFilesQuery.data.files))
    }
  }, [rootFilesQuery.data])

  // Reset search when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery("")
    }
  }, [open])

  const fetchFiles = useCallback(
    async (path: string, force = false) => {
      if (fileTree.has(path) && !force) return

      try {
        const { data } = await listProjectFiles({
          path: { id: projectId },
          query: { path, hideDotfiles: true },
        })
        setFileTree((prev) => new Map(prev).set(path, data?.files ?? []))
      } catch (err) {
        console.error("Error fetching files:", err)
      }
    },
    [projectId, fileTree]
  )

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

  const handleFileSelect = (path: string) => {
    onFileSelect(path)
    onOpenChange(false)
  }

  // Filter files by search query
  const filterFiles = (files: FileEntry[]): FileEntry[] => {
    if (!searchQuery) return files
    const query = searchQuery.toLowerCase()
    return files.filter((file) => file.name.toLowerCase().includes(query))
  }

  const renderTree = (path: string, depth: number = 0): React.ReactNode => {
    const files = fileTree.get(path)
    if (!files) return null

    const filtered = filterFiles(files)
    const sorted = [...filtered].sort((a, b) => {
      if (a.type === "directory" && b.type !== "directory") return -1
      if (a.type !== "directory" && b.type === "directory") return 1
      return a.name.localeCompare(b.name)
    })

    return (
      <>
        {sorted.map((file) => (
          <PickerFileTreeItem
            key={file.path}
            file={file}
            depth={depth}
            isExpanded={expanded.has(file.path)}
            onToggle={() => toggleFolder(file.path)}
            onSelect={() => handleFileSelect(file.path)}
          >
            {renderTree(file.path, depth + 1)}
          </PickerFileTreeItem>
        ))}
      </>
    )
  }

  const rootFiles = fileTree.get(".")
  const isRootLoading = rootFilesQuery.isLoading

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select file</DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search files"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>

        {/* File Tree */}
        <div className="max-h-96 overflow-y-auto -mx-6 px-4">
          {isRootLoading && !rootFiles ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : rootFiles?.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">No files</div>
          ) : (
            <div className="py-1">{renderTree(".")}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
