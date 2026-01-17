import { useViewer } from "@ifc-viewer/viewer"
import { useCallback } from "react"
import { type SelectedElement, useElementSelection } from "./use-element-selection"

/** Shared hook for handling element selection in viewers */
export function useElementSelectHandler() {
  const { selectElements, isInitialized } = useViewer()
  const { selectedElements, setSelectedElements, clearSelection, getElement } =
    useElementSelection()

  const handleElementSelect = useCallback(
    async (modelId: string, localId: number) => {
      if (isInitialized && selectElements) {
        await selectElements(modelId, [localId])
      }
      const element = await getElement(modelId, localId)
      if (element) {
        const newElement: SelectedElement = {
          modelId,
          localId,
          data: element as Record<string, unknown>,
        }
        setSelectedElements([newElement])
      }
    },
    [getElement, selectElements, isInitialized, setSelectedElements]
  )

  return {
    selectedElements,
    clearSelection,
    handleElementSelect,
  }
}
