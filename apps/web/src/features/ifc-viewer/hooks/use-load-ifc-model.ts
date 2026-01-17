import { getModelFile, getModelFragment, listModels, readProjectFile } from "@ifc-viewer/sdk"
import { listModelsQueryKey } from "@ifc-viewer/sdk/hooks"
import { useViewer } from "@ifc-viewer/viewer"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"

export interface UseLoadIFCModelOptions {
  projectId: string
  filePath: string
  /** Whether to load the model (defaults to true) */
  enabled?: boolean
}

export interface UseLoadIFCModelResult {
  /** Whether the model is currently being loaded */
  isLoading: boolean
  /** Whether the model has been successfully loaded */
  isLoaded: boolean
  /** Error message if loading failed */
  error: string | null
}

/**
 * Hook that fetches and loads an IFC model into the viewer.
 * Handles both pre-converted fragments (faster) and raw IFC files.
 *
 * Must be used within a ViewerProvider context.
 */
export function useLoadIFCModel({
  projectId,
  filePath,
  enabled = true,
}: UseLoadIFCModelOptions): UseLoadIFCModelResult {
  const { loadModel, loadFragment, unloadAllModels, isInitialized } = useViewer()
  const loadedPathRef = useRef<string | null>(null)
  const loadingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // Query for models list to find the model by filePath
  const modelsQuery = useQuery({
    queryKey: listModelsQueryKey({ path: { id: projectId } }),
    queryFn: async () => {
      const { data } = await listModels({ path: { id: projectId } })
      return data ?? []
    },
    staleTime: 60_000,
    enabled,
  })

  // Find the model matching this filePath
  const model = useMemo(() => {
    if (!modelsQuery.data) return null
    return modelsQuery.data.find((m) => m.filePath === filePath) ?? null
  }, [modelsQuery.data, filePath])

  // Query for IFC file content - uses Models API if model is found, else falls back to file API
  const contentQuery = useQuery({
    queryKey: ["ifc-content", projectId, filePath, model?.id],
    queryFn: async () => {
      if (model) {
        // Use Models API with SDK - fetch as blob and convert to ArrayBuffer
        const response = await getModelFile({
          path: { id: projectId, modelId: model.id },
          parseAs: "blob",
        })
        if (!response.data) {
          throw new Error("Failed to fetch model file: No data received")
        }
        const buffer = await (response.data as Blob).arrayBuffer()
        return { type: "binary" as const, buffer }
      } else {
        // Fall back to file API for unregistered IFC files
        const { data } = await readProjectFile({
          path: { id: projectId },
          query: { path: filePath },
        })
        return { type: "file-api" as const, data }
      }
    },
    enabled:
      enabled && isInitialized && loadedPathRef.current !== filePath && modelsQuery.isSuccess,
    staleTime: Infinity,
  })

  // Load the model when content is available
  useEffect(() => {
    if (!enabled) return
    if (!isInitialized) return
    if (loadingRef.current) return
    if (loadedPathRef.current === filePath) return
    if (!contentQuery.data) return

    loadingRef.current = true
    setError(null)
    setIsLoaded(false)

    const load = async () => {
      try {
        await unloadAllModels()

        const filename = filePath.split("/").pop() || "model.ifc"

        // Try loading pre-converted fragment if available (faster)
        if (model?.fragmentPath) {
          try {
            const fragmentResponse = await getModelFragment({
              path: { id: projectId, modelId: model.id },
              parseAs: "blob",
            })
            if (fragmentResponse.data) {
              const fragmentBuffer = await (fragmentResponse.data as Blob).arrayBuffer()
              await loadFragment(fragmentBuffer, filename)
              loadedPathRef.current = filePath
              setIsLoaded(true)
              return
            }
          } catch (fragmentError) {
            // Fragment loading failed, fall back to IFC
            console.warn("Fragment loading failed, falling back to IFC:", fragmentError)
          }
        }

        // Fall back to loading IFC directly
        const result = contentQuery.data
        let buffer: ArrayBuffer

        if (result.type === "binary") {
          buffer = result.buffer
        } else if (result.data?.type === "binary") {
          const binary = atob(result.data.content ?? "")
          buffer = new ArrayBuffer(binary.length)
          const view = new Uint8Array(buffer)
          for (let i = 0; i < binary.length; i++) {
            view[i] = binary.charCodeAt(i)
          }
        } else {
          const encoder = new TextEncoder()
          buffer = encoder.encode(result.data?.content ?? "").buffer
        }

        await loadModel(buffer, filename)
        loadedPathRef.current = filePath
        setIsLoaded(true)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        console.error("Failed to load IFC:", err)
        setError(`Failed to load model: ${message}`)
      } finally {
        loadingRef.current = false
      }
    }

    load()
  }, [
    enabled,
    isInitialized,
    filePath,
    contentQuery.data,
    loadModel,
    loadFragment,
    unloadAllModels,
    model,
    projectId,
  ])

  // Handle query errors
  useEffect(() => {
    if (contentQuery.error) {
      const message =
        contentQuery.error instanceof Error ? contentQuery.error.message : "Unknown error"
      setError(`Failed to load model: ${message}`)
    }
  }, [contentQuery.error])

  const isLoading =
    enabled &&
    !isLoaded &&
    !error &&
    (modelsQuery.isLoading || contentQuery.isLoading || loadingRef.current)

  return {
    isLoading,
    isLoaded,
    error,
  }
}
