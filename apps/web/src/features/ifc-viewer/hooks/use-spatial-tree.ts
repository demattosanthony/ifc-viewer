/**
 * Spatial Tree Hook
 *
 * React hook for building and managing the spatial hierarchy tree.
 * Uses the shared buildSpatialTree utility.
 */

import { useViewer } from "@ifc-viewer/viewer"
import { useCallback, useState } from "react"
import { buildSpatialTree, type TreeNode } from "../utils/spatial-tree"

/** Tree node with depth for UI rendering */
export interface TreeNodeData extends TreeNode {
  depth: number
  children: TreeNodeData[]
}

/** Add depth to tree nodes for UI indentation */
function addDepth(nodes: TreeNode[], depth = 0): TreeNodeData[] {
  return nodes.map((node) => ({
    ...node,
    depth,
    children: addDepth(node.children, depth + 1),
  }))
}

export function useSpatialTree() {
  const viewer = useViewer()
  const [treeData, setTreeData] = useState<TreeNodeData[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const buildTree = useCallback(async () => {
    if (!viewer.fragmentsManager || viewer.loadedModels.size === 0) {
      setTreeData([])
      return
    }

    setIsLoading(true)

    try {
      const trees = await buildSpatialTree(viewer)
      setTreeData(addDepth(trees))
    } catch (error) {
      console.error("Failed to build spatial tree:", error)
      setTreeData([])
    } finally {
      setIsLoading(false)
    }
  }, [viewer])

  return {
    treeData,
    isLoading,
    buildTree,
    loadedModels: viewer.loadedModels,
  }
}
