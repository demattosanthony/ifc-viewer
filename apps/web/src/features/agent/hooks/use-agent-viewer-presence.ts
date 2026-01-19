/**
 * Agent Viewer Presence Hook
 *
 * Handles viewer-exec events from the AI agent.
 * Must be used inside a ViewerProvider.
 */

import type { AIEvent } from "@ifc-viewer/core"
import { getModelFile, getModelFragment, listModels } from "@ifc-viewer/sdk"
import { provideViewerResultMutation } from "@ifc-viewer/sdk/hooks"
import type { ViewerContextValue } from "@ifc-viewer/viewer"
import { useViewer } from "@ifc-viewer/viewer"
import { useMutation } from "@tanstack/react-query"
import { useCallback, useEffect } from "react"
import { extractElementData } from "@/features/ifc-viewer/utils/ifc-element"
import { getChildren, getHierarchy } from "@/features/ifc-viewer/utils/spatial-tree"
import { useAgentStore } from "../context"

interface UseAgentViewerPresenceOptions {
  projectId: string
  conversationId: string | null
}

export function useAgentViewerPresence({
  projectId,
  conversationId,
}: UseAgentViewerPresenceOptions) {
  const { onPresenceEvent } = useAgentStore()
  const viewer = useViewer()
  const sendViewerResult = useMutation(provideViewerResultMutation())

  const handleEvent = useCallback(
    async (event: AIEvent) => {
      if (event.type !== "viewer-exec") return
      if (!conversationId) return

      const result = await executeViewerCode(event.code, viewer, projectId)

      await sendViewerResult.mutateAsync({
        path: { id: projectId, conversationId },
        body: { callbackToken: event.callbackToken, result },
      })
    },
    [viewer, projectId, conversationId, sendViewerResult]
  )

  useEffect(() => {
    return onPresenceEvent(handleEvent)
  }, [onPresenceEvent, handleEvent])
}

/**
 * Creates the viewer API and executes the provided code.
 */
async function executeViewerCode(
  code: string,
  viewer: ViewerContextValue,
  projectId: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const api = {
    // =========================================================================
    // Model Management
    // =========================================================================

    /** List models available to load from the project */
    getAvailableModels: async () => {
      const response = await listModels({ path: { id: projectId } })
      return (response.data ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        hasFragment: m.fragmentPath != null,
      }))
    },

    /** Get currently loaded models in the viewer */
    getLoadedModels: () =>
      Array.from(viewer.loadedModels.entries()).map(([id, m]) => ({
        id,
        name: m.name,
      })),

    /** Load a model by its API ID */
    loadModel: async (modelId: string) => {
      // Get model info
      const response = await listModels({ path: { id: projectId } })
      const modelInfo = response.data?.find((m) => m.id === modelId)
      if (!modelInfo) {
        throw new Error(`Model ${modelId} not found`)
      }

      const name = modelInfo.name
      const hasFragment = modelInfo.fragmentPath != null

      if (hasFragment) {
        // Load pre-converted fragment (faster)
        const fragResponse = await getModelFragment({
          path: { id: projectId, modelId },
          parseAs: "blob",
        })
        if (!fragResponse.data) throw new Error("Failed to fetch fragment")
        const buffer = await (fragResponse.data as Blob).arrayBuffer()
        await viewer.loadFragment(buffer, name)
      } else {
        // Load IFC and convert
        const fileResponse = await getModelFile({
          path: { id: projectId, modelId },
          parseAs: "blob",
        })
        if (!fileResponse.data) throw new Error("Failed to fetch model file")
        const buffer = await (fileResponse.data as Blob).arrayBuffer()
        await viewer.loadModel(buffer, name)
      }

      return { loaded: name }
    },

    /** Unload a model by its viewer ID */
    unloadModel: async (viewerModelId: string) => {
      await viewer.unloadModel(viewerModelId)
      return { unloaded: viewerModelId }
    },

    /** Unload all models */
    unloadAllModels: async () => {
      await viewer.unloadAllModels()
      return { unloadedAll: true }
    },

    // =========================================================================
    // Hierarchy & Elements
    // =========================================================================

    /** Get hierarchy (full depth, truncated to ~15 children per node) */
    getHierarchy: async () => {
      return getHierarchy(viewer)
    },

    /** Get all children of a node (use when totalChildren > children.length) */
    getChildren: async (modelId: string, localId: number) => {
      return getChildren(viewer, modelId, localId)
    },

    /** Get detailed element data */
    getElement: async (modelId: string, elementId: number) => {
      const raw = await viewer.getElement(modelId, elementId)
      if (!raw) return null
      return extractElementData(raw)
    },

    /** Select elements and return their details */
    select: async (modelId: string, elementIds: number[], options?: { fitToView?: boolean }) => {
      await viewer.selectElements(modelId, elementIds, {
        clearPrevious: true,
        fitToView: options?.fitToView ?? false,
      })

      // Return element details for selected elements
      const details = await Promise.all(
        elementIds.map(async (id) => {
          const raw = await viewer.getElement(modelId, id)
          if (!raw) return { elementId: id, data: null }
          return { elementId: id, data: extractElementData(raw) }
        })
      )
      return details
    },

    /** Clear all selection/highlights */
    clearSelection: () => {
      viewer.interactionManager?.clearSelection()
    },

    // =========================================================================
    // Floor Plans
    // =========================================================================

    /** Get available floor plans */
    getPlans: () => viewer.planViews?.plans ?? [],

    /** Open a floor plan view */
    openPlan: (planId: string) => {
      viewer.planViews?.open(planId)
    },

    /** Close the current plan view */
    closePlan: () => {
      viewer.planViews?.close()
    },

    /** Get the currently active plan ID */
    getActivePlan: () => viewer.planViews?.activePlanId ?? null,
  }

  try {
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
    const fn = new AsyncFunction("viewer", `"use strict"; ${code}`)
    const result = await fn(api)
    return { success: true, result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
