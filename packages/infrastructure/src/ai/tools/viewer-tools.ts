/**
 * Viewer Tools
 *
 * Client-side tool for controlling the IFC viewer.
 * Code executes in the browser, results return to agent.
 */

import type { AIEvent } from "@ifc-viewer/core"
import { tool } from "ai"
import { z } from "zod"

export interface ViewerToolsOptions {
  emit: (event: AIEvent) => void
  waitForResult: (token: string, timeout?: number) => Promise<unknown>
}

export function createViewerTools(options: ViewerToolsOptions) {
  const { emit, waitForResult } = options

  return {
    executeViewer: tool({
      description: `Execute JavaScript in the IFC 3D viewer (runs in browser). See the ifc-viewer skill for full API documentation.

Quick reference:
- viewer.getAvailableModels() / getLoadedModels() / loadModel(id) / unloadModel(id)
- viewer.getHierarchy() / getChildren(modelId, localId)
- viewer.getElement(modelId, localId) / select(modelId, [localIds]) / clearSelection()
- viewer.getPlans() / openPlan(id) / closePlan()`,

      inputSchema: z.object({
        code: z.string().describe("JavaScript code to execute in the viewer"),
      }),

      execute: async ({ code }: { code: string }) => {
        const callbackToken = crypto.randomUUID()

        emit({ type: "viewer-exec", callbackToken, code })

        try {
          return await waitForResult(callbackToken, 30000)
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Viewer execution failed",
          }
        }
      },
    }),
  }
}
