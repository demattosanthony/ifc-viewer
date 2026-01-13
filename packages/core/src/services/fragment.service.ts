/**
 * Fragment Service
 *
 * Handles regeneration of fragment files when IFC files are modified.
 * Used as a callback for the change-tracker to keep fragments up-to-date
 * when the AI agent modifies IFC models.
 */

import { createLogger } from "@ifc-viewer/logger"
import { getModelStorageKey } from "../domain"
import type { Database, IFCProcessor, Storage } from "../ports"
import type { OnFileSyncCallback } from "./change-tracker"

const log = createLogger("fragment-service")

/**
 * Create an onFileSync callback that regenerates fragments for IFC files.
 *
 * @param db - Database instance for model metadata
 * @param storage - Storage instance for file operations
 * @param ifcProcessor - IFC processor for converting IFC to fragments
 */
export function createFragmentRegenerator(
  db: Database,
  storage: Storage,
  ifcProcessor: IFCProcessor
): OnFileSyncCallback {
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

      // Convert to fragments using the processor
      const fragmentData = await ifcProcessor.convert(obj.data)
      const fragmentPath = ifcProcessor.getFragmentPath(path)

      // Store the new fragment (overwrite if exists)
      const fragmentStorageKey = getModelStorageKey(projectId, fragmentPath)
      await storage.put(fragmentStorageKey, fragmentData, {
        contentType: "application/octet-stream",
      })

      // Update model metadata
      await db.models.update(model.id, {
        fragmentPath,
        fragmentSize: fragmentData.byteLength,
        fragmentVersion: ifcProcessor.version,
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
