import { type ElementSelectedEvent, useViewer, useViewerEvents } from "@ifc-viewer/viewer"
import { useCallback, useState } from "react"

export interface SelectedElement {
  data: Record<string, unknown>
}

/**
 * Hook for handling IFC element selection from the 3D viewer.
 * Provides state management and event handling for element selection.
 */
export function useElementSelection() {
  const { getElement } = useViewer()
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)

  useViewerEvents({
    onElementSelected: useCallback(
      async (event: ElementSelectedEvent) => {
        const entries = Object.entries(event.modelIdMap)
        if (entries.length === 0) {
          setSelectedElement(null)
          return
        }
        for (const [modelId, localIdSet] of entries) {
          for (const localId of localIdSet) {
            const element = await getElement(modelId, localId)
            if (element) {
              setSelectedElement({ data: element as Record<string, unknown> })
              return
            }
          }
        }
      },
      [getElement]
    ),
  })

  const clearSelection = useCallback(() => {
    setSelectedElement(null)
  }, [])

  return {
    selectedElement,
    setSelectedElement,
    clearSelection,
    getElement,
  }
}
