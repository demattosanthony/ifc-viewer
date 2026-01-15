import { Button, Popover, PopoverContent, PopoverTrigger } from "@ifc-viewer/ui/components"
import { ChevronDown, ChevronRight, ListTree } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { type TreeNodeData, useSpatialTree } from "../hooks/use-spatial-tree"

interface HierarchyPopoverProps {
  onElementSelect: (modelId: string, localId: number) => void
}

interface TreeNodeProps {
  node: TreeNodeData
  onSelect: (modelId: string, localId: number) => void
  selectedId: string | null
}

function TreeNode({ node, onSelect, selectedId }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(node.depth < 5)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

  const handleClick = () => {
    if (node.localId !== null) {
      onSelect(node.modelId, node.localId)
    }
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  return (
    <div>
      <Button
        variant={isSelected ? "secondary" : "ghost"}
        onClick={handleClick}
        className="w-full justify-start gap-1 py-1 px-2 h-auto text-sm font-normal rounded-sm"
        style={{ paddingLeft: `${node.depth * 8 + 8}px` }}
      >
        {hasChildren ? (
          <Button variant="ghost" size="icon-sm" onClick={handleToggle} className="size-5 p-0.5">
            {isExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </Button>
        ) : (
          <span className="w-5" />
        )}
        <span className="truncate">{node.name}</span>
      </Button>
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </div>
      )}
    </div>
  )
}

export function HierarchyPopover({ onElementSelect }: HierarchyPopoverProps) {
  const [open, setOpen] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const { treeData, isLoading, buildTree, loadedModels } = useSpatialTree()

  useEffect(() => {
    if (open) {
      buildTree()
    }
  }, [buildTree, open])

  const handleSelect = useCallback(
    (modelId: string, localId: number) => {
      setSelectedNodeId(`${modelId}-${localId}`)
      onElementSelect(modelId, localId)
    },
    [onElementSelect]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Spatial Hierarchy">
          <ListTree className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 overflow-hidden" align="center" side="top" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-muted/30">
          <ListTree className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Hierarchy</span>
        </div>

        {/* Tree Content */}
        <div className="max-h-80 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
              Building hierarchy...
            </div>
          ) : treeData.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
              {loadedModels.size === 0 ? "Load a model to see hierarchy" : "No hierarchy data"}
            </div>
          ) : (
            <div>
              {treeData.map((tree) => (
                <TreeNode
                  key={tree.id}
                  node={tree}
                  onSelect={handleSelect}
                  selectedId={selectedNodeId}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
