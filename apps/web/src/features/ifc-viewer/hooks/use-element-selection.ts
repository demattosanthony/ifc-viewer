import { type ElementSelectedEvent, useViewer, useViewerEvents } from "@ifc-viewer/viewer"
import { useCallback, useState } from "react"

export interface SelectedElement {
  modelId: string
  localId: number
  data: Record<string, unknown>
}

/**
 * Hook for handling IFC element selection from the 3D viewer.
 * Provides state management and event handling for element selection.
 * Supports multi-element selection via Ctrl+click.
 */
export function useElementSelection() {
  const { getElement } = useViewer()
  const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([])

  useViewerEvents({
    onElementSelected: useCallback(
      async (event: ElementSelectedEvent) => {
        const entries = Object.entries(event.modelIdMap)
        if (entries.length === 0) {
          setSelectedElements([])
          return
        }

        const elements: SelectedElement[] = []
        for (const [modelId, localIdSet] of entries) {
          for (const localId of localIdSet) {
            const element = await getElement(modelId, localId)
            if (element) {
              elements.push({
                modelId,
                localId,
                data: element as Record<string, unknown>,
              })
            }
          }
        }
        setSelectedElements(elements)
      },
      [getElement]
    ),
  })

  const clearSelection = useCallback(() => {
    setSelectedElements([])
  }, [])

  return {
    selectedElements,
    setSelectedElements,
    clearSelection,
    getElement,
  }
}
