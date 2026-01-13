import { Progress } from "@ifc-viewer/ui/components/progress"
import { useViewer } from "@ifc-viewer/viewer"
import { Check, ChevronDown, ChevronRight, FileBox, Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { ModeSwitch } from "@/shared/components/mode-switch"
import { useProjectModels } from "../hooks/use-project-models"

interface SpatialTreeItem {
  category: string | null
  localId: number | null
  children?: SpatialTreeItem[]
}

interface TreeNodeData {
  id: string
  modelId: string
  category: string | null
  localId: number | null
  name: string
  children: TreeNodeData[]
  depth: number
}

interface SpatialHierarchySidebarProps {
  projectId: string
  onElementSelect: (modelId: string, localId: number) => void
}

const IFC_CATEGORY_WORDS = [
  "BUILDING",
  "STOREY",
  "WALL",
  "STANDARD",
  "CASE",
  "CURTAIN",
  "FURNISHING",
  "ELEMENT",
  "DISTRIBUTION",
  "FLOW",
  "SYSTEM",
  "EQUIPMENT",
  "TERMINAL",
  "DEVICE",
  "OPENING",
  "COVERING",
  "SHADING",
  "STRUCTURAL",
  "CONNECTION",
  "STAIR",
  "FLIGHT",
  "RAMP",
  "SLAB",
  "COLUMN",
  "BEAM",
  "ROOF",
  "PLATE",
  "MEMBER",
  "FOOTING",
  "PILE",
  "GRID",
  "AXIS",
  "ZONE",
  "GROUP",
  "PORT",
  "CONTROL",
]

const IFC_CATEGORY_WORDS_BY_LENGTH = [...IFC_CATEGORY_WORDS].sort((a, b) => b.length - a.length)

function toTitleCase(value: string): string {
  if (!value) return value
  if (/\d/.test(value)) return value
  if (value === value.toUpperCase()) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  }
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function splitAllCapsCategory(value: string): string[] {
  const words: string[] = []
  let remaining = value

  while (remaining.length > 0) {
    const match = IFC_CATEGORY_WORDS_BY_LENGTH.find((word) => remaining.startsWith(word))
    if (!match) {
      words.push(remaining)
      break
    }
    words.push(match)
    remaining = remaining.slice(match.length)
  }

  return words
}

function getCategoryLabel(category: string | null): string {
  if (!category) return "Element"

  const cleaned = category.replace(/^IFC/i, "").replace(/[_-]+/g, " ").trim()
  if (!cleaned) return "Element"

  const words: string[] = []
  for (const part of cleaned.split(/\s+/)) {
    if (!part) continue
    if (/[a-z]/.test(part)) {
      words.push(...part.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" "))
      continue
    }
    words.push(...splitAllCapsCategory(part))
  }

  return words.map(toTitleCase).join(" ")
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
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleClick()
          }
        }}
        className={`
          flex items-center gap-1 py-1 px-2 cursor-pointer text-sm
          hover:bg-accent transition-colors rounded-sm
          ${isSelected ? "bg-accent text-accent-foreground" : "text-muted-foreground"}
        `}
        style={{ paddingLeft: `${node.depth * 8 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={handleToggle} className="p-0.5 hover:bg-accent-foreground/10 rounded">
            {isExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="truncate">{node.name}</span>
      </div>
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

export function SpatialHierarchySidebar({
  projectId,
  onElementSelect,
}: SpatialHierarchySidebarProps) {
  const { loadedModels, fragmentsManager, isInitialized } = useViewer()
  const {
    models,
    isLoading: modelsLoading,
    loadModel,
    unloadModel,
    isModelLoaded,
    getLoadedModelId,
    loadingModelId,
    loadProgress,
  } = useProjectModels(projectId)
  const [treeData, setTreeData] = useState<TreeNodeData[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isLoadingTree, setIsLoadingTree] = useState(false)
  const [modelsExpanded, setModelsExpanded] = useState(true)
  const [hierarchyExpanded, setHierarchyExpanded] = useState(true)

  // Auto-load first model when entering viewer mode
  useEffect(() => {
    if (!isInitialized) return

    if (models && models.length > 0 && loadedModels.size === 0 && !loadingModelId) {
      const firstModel = models[0]
      if (firstModel) {
        loadModel(firstModel.id)
      }
    }
  }, [models, loadedModels.size, loadModel, loadingModelId, isInitialized])

  // Build tree from loaded models
  const buildTree = useCallback(async () => {
    if (!fragmentsManager || loadedModels.size === 0) {
      setTreeData([])
      return
    }

    setIsLoadingTree(true)

    try {
      const trees: TreeNodeData[] = []

      for (const [modelId, loadedModel] of loadedModels) {
        const model = fragmentsManager.list.get(modelId)
        if (!model) continue

        const spatialStructure = await model.getSpatialStructure()

        const buildNode = async (
          item: SpatialTreeItem,
          depth: number,
          parentId: string
        ): Promise<TreeNodeData | null> => {
          const nodeId = `${parentId}-${item.localId ?? item.category ?? "root"}`
          let name: string | null = null
          const categoryLabel = getCategoryLabel(item.category)

          if (item.localId !== null) {
            try {
              const itemsData = await model.getItemsData([item.localId])
              const attrs = itemsData[0]
              const nameAttr = attrs?.Name
              if (nameAttr && "value" in nameAttr && nameAttr.value) {
                name = String(nameAttr.value)
              }
            } catch {
              // No name available
            }
          }

          const children: TreeNodeData[] = []
          if (item.children) {
            for (const child of item.children) {
              const childNode = await buildNode(child, depth + 1, nodeId)
              if (childNode) {
                children.push(childNode)
              }
            }
          }

          if (!name && children.length === 1 && children[0]) {
            const promoted = children[0]
            promoted.depth = depth
            return promoted
          }

          if (!name && item.localId === null && children.length === 0) {
            return null
          }

          return {
            id: nodeId,
            modelId,
            category: item.category,
            localId: item.localId,
            name: name || categoryLabel,
            children,
            depth,
          }
        }

        const modelTree = await buildNode(spatialStructure, 0, modelId)
        if (modelTree) {
          modelTree.name = loadedModel.name || `Model ${modelId.slice(0, 8)}`
          modelTree.depth = 0
          trees.push(modelTree)
        }
      }

      setTreeData(trees)
    } catch (error) {
      console.error("Failed to build spatial tree:", error)
    } finally {
      setIsLoadingTree(false)
    }
  }, [fragmentsManager, loadedModels])

  useEffect(() => {
    buildTree()
  }, [buildTree])

  const handleSelect = useCallback(
    (modelId: string, localId: number) => {
      setSelectedNodeId(`${modelId}-${localId}`)
      onElementSelect(modelId, localId)
    },
    [onElementSelect]
  )

  const handleModelToggle = useCallback(
    (modelId: string) => {
      const loaded = isModelLoaded(modelId)
      if (loaded) {
        const loadedId = getLoadedModelId(modelId)
        if (loadedId) {
          unloadModel(loadedId)
        }
      } else {
        loadModel(modelId)
      }
    },
    [isModelLoaded, getLoadedModelId, unloadModel, loadModel]
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b px-2 h-[41px] flex items-center">
        <ModeSwitch />
      </div>

      {/* Models Section */}
      <div className="shrink-0 border-b">
        <button
          onClick={() => setModelsExpanded(!modelsExpanded)}
          className="w-full px-2 py-2 flex items-center gap-1 text-left hover:bg-accent/50 transition-colors"
        >
          {modelsExpanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Models
          </span>
          <span className="text-[11px] text-muted-foreground ml-auto">
            {loadedModels.size}/{models?.length ?? 0}
          </span>
        </button>

        {modelsExpanded && (
          <div className="px-2 pb-2">
            {modelsLoading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Loading...
              </div>
            ) : !models || models.length === 0 ? (
              <div className="py-2 text-sm text-muted-foreground">No models in project</div>
            ) : (
              <div className="space-y-1">
                {models.map((model) => {
                  const loaded = isModelLoaded(model.id)
                  const isLoadingThis = loadingModelId === model.id

                  return (
                    <div key={model.id}>
                      <button
                        onClick={() => handleModelToggle(model.id)}
                        disabled={isLoadingThis || (loadingModelId !== null && !isLoadingThis)}
                        className="w-full flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent transition-colors text-left disabled:opacity-50"
                      >
                        <div className="shrink-0">
                          {isLoadingThis ? (
                            <Loader2 className="size-4 animate-spin text-primary" />
                          ) : loaded ? (
                            <Check className="size-4 text-green-500" />
                          ) : (
                            <FileBox className="size-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{model.name}</p>
                        </div>
                      </button>
                      {isLoadingThis && loadProgress > 0 && (
                        <Progress value={loadProgress * 100} className="h-1 mx-2 mt-1" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hierarchy Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <button
          onClick={() => setHierarchyExpanded(!hierarchyExpanded)}
          className="shrink-0 w-full px-2 py-2 flex items-center gap-1 text-left border-b hover:bg-accent/50 transition-colors"
        >
          {hierarchyExpanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Hierarchy
          </span>
        </button>

        {hierarchyExpanded && (
          <div className="flex-1 overflow-auto p-2">
            {isLoadingTree ? (
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
        )}
      </div>
    </div>
  )
}
