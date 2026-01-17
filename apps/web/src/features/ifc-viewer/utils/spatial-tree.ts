/**
 * Spatial Tree Utilities
 *
 * Builds hierarchical tree from IFC spatial structure.
 * Uses smart truncation to keep responses manageable while showing full depth.
 */

import type { ViewerContextValue } from "@ifc-viewer/viewer"
import { getCategoryLabel } from "./ifc-categories"

interface SpatialTreeItem {
  category: string | null
  localId: number | null
  children?: SpatialTreeItem[]
}

export interface TreeNode {
  id: string
  modelId: string
  name: string
  category: string | null
  localId: number | null
  children: TreeNode[]
  /** Total number of children (may be more than children.length if truncated) */
  totalChildren: number
}

/** Max children per node before truncation */
const MAX_CHILDREN = 15

/**
 * Get hierarchy with smart truncation.
 * Returns full depth but limits children per node to keep size manageable.
 */
export async function getHierarchy(
  viewer: Pick<ViewerContextValue, "fragmentsManager" | "loadedModels">
): Promise<TreeNode[]> {
  const { fragmentsManager, loadedModels } = viewer

  if (!fragmentsManager || loadedModels.size === 0) return []

  const trees: TreeNode[] = []

  for (const [modelId, loadedModel] of loadedModels) {
    const model = fragmentsManager.list.get(modelId)
    if (!model) continue

    const spatialStructure = await model.getSpatialStructure()
    const modelTree = await buildNode(model, spatialStructure, modelId, modelId, MAX_CHILDREN)
    if (modelTree) {
      modelTree.name = loadedModel.name || `Model ${modelId.slice(0, 8)}`
      trees.push(modelTree)
    }
  }

  return trees
}

/**
 * Get all children of a specific element (no truncation).
 * Use when you need the full list after seeing a truncated node.
 */
export async function getChildren(
  viewer: Pick<ViewerContextValue, "fragmentsManager" | "loadedModels">,
  modelId: string,
  parentLocalId: number
): Promise<TreeNode[]> {
  const { fragmentsManager } = viewer

  if (!fragmentsManager) return []

  const model = fragmentsManager.list.get(modelId)
  if (!model) return []

  const spatialStructure = await model.getSpatialStructure()
  const parentItem = findItemByLocalId(spatialStructure, parentLocalId)
  if (!parentItem?.children) return []

  // Build all children (no limit)
  const children: TreeNode[] = []
  for (const child of parentItem.children) {
    const node = await buildNode(model, child, modelId, `${modelId}-${parentLocalId}`, Infinity)
    if (node) children.push(node)
  }

  return children
}

/**
 * Build full tree for UI (no truncation).
 */
export async function buildSpatialTree(
  viewer: Pick<ViewerContextValue, "fragmentsManager" | "loadedModels">
): Promise<TreeNode[]> {
  const { fragmentsManager, loadedModels } = viewer

  if (!fragmentsManager || loadedModels.size === 0) return []

  const trees: TreeNode[] = []

  for (const [modelId, loadedModel] of loadedModels) {
    const model = fragmentsManager.list.get(modelId)
    if (!model) continue

    const spatialStructure = await model.getSpatialStructure()
    const modelTree = await buildNode(model, spatialStructure, modelId, modelId, Infinity)
    if (modelTree) {
      modelTree.name = loadedModel.name || `Model ${modelId.slice(0, 8)}`
      trees.push(modelTree)
    }
  }

  return trees
}

// ============================================================================
// Internal Helpers
// ============================================================================

interface FragmentsModel {
  getItemsData(ids: number[]): Promise<unknown[]>
  getSpatialStructure(): Promise<SpatialTreeItem>
}

async function buildNode(
  model: FragmentsModel,
  item: SpatialTreeItem,
  modelId: string,
  parentId: string,
  maxChildren: number
): Promise<TreeNode | null> {
  const nodeId = `${parentId}-${item.localId ?? item.category ?? "root"}`
  let name: string | null = null
  const categoryLabel = getCategoryLabel(item.category)

  // Get element name if it has a localId
  if (item.localId !== null) {
    try {
      const itemsData = await model.getItemsData([item.localId])
      const attrs = itemsData[0] as Record<string, unknown> | undefined
      const nameAttr = attrs?.Name as { value?: unknown } | undefined
      if (nameAttr?.value) {
        name = String(nameAttr.value)
      }
    } catch {
      // No name available
    }
  }

  const totalChildItems = item.children?.length ?? 0

  // Build children with optional truncation
  const children: TreeNode[] = []
  if (item.children) {
    const childrenToProcess = item.children.slice(0, maxChildren)
    for (const child of childrenToProcess) {
      const childNode = await buildNode(model, child, modelId, nodeId, maxChildren)
      if (childNode) children.push(childNode)
    }
  }

  // Skip intermediate nodes with no name and single child (promote child)
  if (!name && children.length === 1 && children[0] && totalChildItems === 1) {
    return children[0]
  }

  // Skip empty category nodes
  if (!name && item.localId === null && children.length === 0 && totalChildItems === 0) {
    return null
  }

  return {
    id: nodeId,
    modelId,
    name: name || categoryLabel,
    category: item.category,
    localId: item.localId,
    children,
    totalChildren: totalChildItems,
  }
}

function findItemByLocalId(root: SpatialTreeItem, targetLocalId: number): SpatialTreeItem | null {
  if (root.localId === targetLocalId) return root

  if (root.children) {
    for (const child of root.children) {
      const found = findItemByLocalId(child, targetLocalId)
      if (found) return found
    }
  }

  return null
}
