import { getModelFile, getModelFragment, listModels } from "@ifc-viewer/sdk"
import { listModelsQueryKey } from "@ifc-viewer/sdk/hooks"
import { useViewer } from "@ifc-viewer/viewer"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useState } from "react"

export function useProjectModels(projectId: string) {
  const {
    loadModel: viewerLoadModel,
    loadFragment: viewerLoadFragment,
    unloadModel,
    loadedModels,
    isInitialized,
  } = useViewer()
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null)
  const [loadProgress, setLoadProgress] = useState<number>(0)

  const modelsQuery = useQuery({
    queryKey: listModelsQueryKey({ path: { id: projectId } }),
    queryFn: async () => {
      const response = await listModels({ path: { id: projectId } })
      return response.data ?? []
    },
  })

  const loadModel = useCallback(
    async (modelId: string) => {
      if (!isInitialized || loadingModelId) return

      setLoadingModelId(modelId)
      setLoadProgress(0)

      try {
        // Get model info to check if fragments are available
        const modelInfo = modelsQuery.data?.find((m) => m.id === modelId)
        const name = modelInfo?.name ?? `Model ${modelId.slice(0, 8)}`
        const hasFragment = modelInfo?.fragmentPath != null

        if (hasFragment) {
          // Load pre-converted fragment (faster, no progress callback needed)
          const response = await getModelFragment({
            path: { id: projectId, modelId },
            parseAs: "blob",
          })

          if (!response.data) {
            throw new Error("Failed to fetch fragment file: No data received")
          }

          const buffer = await (response.data as Blob).arrayBuffer()
          await viewerLoadFragment(buffer, name)
        } else {
          // Fallback: Load IFC and convert on-the-fly
          const response = await getModelFile({
            path: { id: projectId, modelId },
            parseAs: "blob",
          })

          if (!response.data) {
            throw new Error("Failed to fetch model file: No data received")
          }

          const buffer = await (response.data as Blob).arrayBuffer()
          await viewerLoadModel(buffer, name, (progress) => {
            setLoadProgress(progress)
          })
        }
      } catch (error) {
        console.error("Failed to load model:", error)
      } finally {
        setLoadingModelId(null)
        setLoadProgress(0)
      }
    },
    [
      projectId,
      viewerLoadModel,
      viewerLoadFragment,
      modelsQuery.data,
      loadingModelId,
      isInitialized,
    ]
  )

  const isModelLoaded = useCallback(
    (modelId: string): boolean => {
      for (const [, model] of loadedModels) {
        const modelInfo = modelsQuery.data?.find((m) => m.id === modelId)
        if (modelInfo && model.name === modelInfo.name) {
          return true
        }
      }
      return false
    },
    [loadedModels, modelsQuery.data]
  )

  const getLoadedModelId = useCallback(
    (apiModelId: string): string | null => {
      const modelInfo = modelsQuery.data?.find((m) => m.id === apiModelId)
      if (!modelInfo) return null

      for (const [loadedId, model] of loadedModels) {
        if (model.name === modelInfo.name) {
          return loadedId
        }
      }
      return null
    },
    [loadedModels, modelsQuery.data]
  )

  return {
    models: modelsQuery.data,
    isLoading: modelsQuery.isLoading,
    error: modelsQuery.error,
    loadedModels,
    loadModel,
    unloadModel,
    isModelLoaded,
    getLoadedModelId,
    loadingModelId,
    loadProgress,
  }
}
