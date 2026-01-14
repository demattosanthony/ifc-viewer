import { useViewer } from "@ifc-viewer/viewer"
import { useCallback, useState } from "react"
import { getCategoryLabel } from "../utils/ifc-categories"

interface SpatialTreeItem {
  category: string | null
  localId: number | null
  children?: SpatialTreeItem[]
}

export interface TreeNodeData {
  id: string
  modelId: string
  category: string | null
  localId: number | null
  name: string
  children: TreeNodeData[]
  depth: number
}

export function useSpatialTree() {
  const { loadedModels, fragmentsManager } = useViewer()
  const [treeData, setTreeData] = useState<TreeNodeData[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const buildTree = useCallback(async () => {
    if (!fragmentsManager || loadedModels.size === 0) {
      setTreeData([])
      return
    }

    setIsLoading(true)

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
      setIsLoading(false)
    }
  }, [fragmentsManager, loadedModels])

  return {
    treeData,
    isLoading,
    buildTree,
    loadedModels,
  }
}
