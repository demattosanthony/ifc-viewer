import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
} from "@ifc-viewer/ui/components"
import { useViewer } from "@ifc-viewer/viewer"
import { Check, FileBox, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useProjectModels } from "../hooks/use-project-models"

interface ModelsPopoverProps {
  projectId: string
}

export function ModelsPopover({ projectId }: ModelsPopoverProps) {
  const [open, setOpen] = useState(false)
  const { isInitialized } = useViewer()
  const {
    models,
    isLoading: modelsLoading,
    loadModel,
    unloadModel,
    isModelLoaded,
    getLoadedModelId,
    loadingModelId,
    loadProgress,
    loadedModels,
  } = useProjectModels(projectId)

  // Auto-load first model when viewer is initialized and no models are loaded
  useEffect(() => {
    if (!isInitialized) return
    if (models && models.length > 0 && loadedModels.size === 0 && !loadingModelId) {
      const firstModel = models[0]
      if (firstModel) {
        loadModel(firstModel.id)
      }
    }
  }, [models, loadedModels.size, loadModel, loadingModelId, isInitialized])

  const handleModelToggle = (modelId: string) => {
    const loaded = isModelLoaded(modelId)
    if (loaded) {
      const loadedId = getLoadedModelId(modelId)
      if (loadedId) {
        unloadModel(loadedId)
      }
    } else {
      loadModel(modelId)
    }
  }

  const loadedCount = loadedModels.size
  const totalCount = models?.length ?? 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Models">
          <FileBox className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 overflow-hidden" align="center" side="top" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
          <span className="text-sm font-medium">Models</span>
          <span className="text-xs text-muted-foreground">
            {loadedCount}/{totalCount}
          </span>
        </div>

        {/* Models List */}
        <div className="py-1 max-h-64 overflow-y-auto">
          {modelsLoading ? (
            <div className="flex items-center gap-2 py-3 px-3 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading...
            </div>
          ) : !models || models.length === 0 ? (
            <div className="py-3 px-3 text-sm text-muted-foreground">No models in project</div>
          ) : (
            models.map((model) => {
              const loaded = isModelLoaded(model.id)
              const isLoadingThis = loadingModelId === model.id

              return (
                <div key={model.id}>
                  <Button
                    variant="ghost"
                    onClick={() => handleModelToggle(model.id)}
                    disabled={isLoadingThis || (loadingModelId !== null && !isLoadingThis)}
                    className="w-full justify-start gap-2 px-3 py-1.5 h-auto rounded-none font-normal"
                  >
                    <div className="shrink-0 w-4 flex items-center justify-center">
                      {isLoadingThis ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : loaded ? (
                        <Check className="size-3.5 text-green-500" />
                      ) : null}
                    </div>
                    <span className="flex-1 text-sm truncate text-left">{model.name}</span>
                  </Button>
                  {isLoadingThis && loadProgress > 0 && (
                    <Progress value={loadProgress * 100} className="h-0.5 mx-3 mb-1" />
                  )}
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
