import { useViewer } from "@ifc-viewer/viewer"
import { useCallback } from "react"
import { useElementSelection } from "./use-element-selection"

/** Shared hook for handling element selection in viewers */
export function useElementSelectHandler() {
  const { selectElements, isInitialized } = useViewer()
  const { selectedElement, setSelectedElement, clearSelection, getElement } = useElementSelection()

  const handleElementSelect = useCallback(
    async (modelId: string, localId: number) => {
      if (isInitialized && selectElements) {
        await selectElements(modelId, [localId])
      }
      const element = await getElement(modelId, localId)
      if (element) {
        setSelectedElement({ data: element as Record<string, unknown> })
      }
    },
    [getElement, selectElements, isInitialized, setSelectedElement]
  )

  return {
    selectedElement,
    clearSelection,
    handleElementSelect,
  }
}
