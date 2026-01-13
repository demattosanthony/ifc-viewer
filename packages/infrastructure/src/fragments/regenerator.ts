/**
 * Fragment Regenerator
 *
 * Handles regeneration of fragment files when IFC files are modified.
 * Used as a callback for the change-tracker to keep fragments up-to-date
 * when the AI agent modifies IFC models.
 */

import type { Database, OnFileSyncCallback, Storage } from "@ifc-viewer/core"
import { getModelStorageKey } from "@ifc-viewer/core"
import { createLogger } from "@ifc-viewer/logger"
import { convertIfcToFragments, FRAGMENT_VERSION, getFragmentPath } from "./converter.ts"

const log = createLogger("fragment-regenerator")

/**
 * Create an onFileSync callback that regenerates fragments for IFC files.
 */
export function createFragmentRegenerator(db: Database, storage: Storage): OnFileSyncCallback {
  return async (projectId, change) => {
    // Only handle IFC files in the models/ directory
    const path = change.path
    if (!path.startsWith("models/") || !path.endsWith(".ifc")) {
      return
    }

    // Only regenerate for create/update operations
    if (change.type !== "create" && change.type !== "update") {
      return
    }

    log.debug("IFC file changed, regenerating fragment", { projectId, path })

    try {
      // Find the model in the database
      const model = await db.models.findByFilePath(projectId, path)
      if (!model) {
        log.warn("Model not found for IFC file", { projectId, path })
        return
      }

      // Fetch the IFC data from storage
      const storageKey = getModelStorageKey(projectId, path)
      const obj = await storage.get(storageKey)
      if (!obj) {
        log.warn("IFC file not found in storage", { projectId, path })
        return
      }

      // Convert to fragments
      const fragmentData = await convertIfcToFragments(obj.data)
      const fragmentPath = getFragmentPath(path)

      // Store the new fragment (overwrite if exists)
      const fragmentStorageKey = getModelStorageKey(projectId, fragmentPath)
      await storage.put(fragmentStorageKey, fragmentData, {
        contentType: "application/octet-stream",
      })

      // Update model metadata
      await db.models.update(model.id, {
        fragmentPath,
        fragmentSize: fragmentData.byteLength,
        fragmentVersion: FRAGMENT_VERSION,
      })

      log.info("Fragment regenerated successfully", {
        projectId,
        modelId: model.id,
        ifcPath: path,
        fragmentPath,
        fragmentSize: fragmentData.byteLength,
      })
    } catch (error) {
      log.error("Failed to regenerate fragment", { projectId, path, error })
      // Don't throw - we don't want to fail the file sync
    }
  }
}
