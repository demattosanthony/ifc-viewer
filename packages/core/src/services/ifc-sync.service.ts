/**
 * IFC Sync Service
 *
 * Handles IFC file changes from the AI agent to keep fragments up-to-date.
 * This is called after files are synced to storage from the compute environment.
 *
 * Scenarios handled:
 * 1. Agent edits existing IFC model → Regenerate fragment
 * 2. Agent creates new IFC file → Auto-register as model with fragment
 * 3. Agent deletes IFC file → Delete model metadata
 */

import { createLogger } from "@ifc-viewer/logger"
import { getModelStorageKey, inferDiscipline } from "../domain"
import type { Database, IFCProcessor, Storage } from "../ports"
import type { OnFileSyncCallback } from "./change-tracker"

const log = createLogger("ifc-sync")

export interface CreateIFCSyncHandlerOptions {
  db: Database
  storage: Storage
  ifcProcessor: IFCProcessor
}

/**
 * Create an onFileSync callback that handles IFC file changes.
 */
export function createIFCSyncHandler(options: CreateIFCSyncHandlerOptions): OnFileSyncCallback {
  const { db, storage, ifcProcessor } = options

  return async (projectId, change) => {
    const path = change.path

    // Only handle IFC files in the models/ directory
    if (!path.startsWith("models/") || !path.toLowerCase().endsWith(".ifc")) {
      return
    }

    const fileName = path.split("/").pop() ?? path

    switch (change.type) {
      case "create": {
        // New IFC file created by agent - auto-register as model
        log.info("New IFC file detected, auto-registering model", { projectId, path })

        try {
          // Fetch the IFC data from storage
          const storageKey = getModelStorageKey(projectId, path)
          const obj = await storage.get(storageKey)
          if (!obj) {
            log.warn("IFC file not found in storage after sync", { projectId, path })
            return
          }

          // Convert to fragments
          let fragmentData: Uint8Array | undefined
          let fragmentPath: string | undefined
          let fragmentVersion: string | undefined

          try {
            fragmentData = await ifcProcessor.convert(obj.data)
            fragmentPath = ifcProcessor.getFragmentPath(path)
            fragmentVersion = ifcProcessor.version

            // Store the fragment
            const fragmentStorageKey = getModelStorageKey(projectId, fragmentPath)
            await storage.put(fragmentStorageKey, fragmentData, {
              contentType: "application/octet-stream",
            })
          } catch (conversionError) {
            log.warn("Fragment conversion failed for new model", {
              projectId,
              path,
              error: conversionError,
            })
          }

          // Create model metadata
          const model = await db.models.create({
            projectId,
            name: fileName.replace(/\.ifc$/i, ""),
            discipline: inferDiscipline(fileName),
            filePath: path,
            fileSize: obj.data.byteLength,
            fragmentPath: fragmentPath ?? null,
            fragmentSize: fragmentData?.byteLength ?? null,
            fragmentVersion: fragmentVersion ?? null,
          })

          log.info("Model auto-registered", {
            projectId,
            modelId: model.id,
            name: model.name,
            hasFragment: !!fragmentPath,
          })
        } catch (error) {
          log.error("Failed to auto-register model", { projectId, path, error })
        }
        break
      }

      case "update": {
        // Existing IFC file modified - regenerate fragment if model exists
        log.info("IFC file modified, checking for model", { projectId, path })

        try {
          const model = await db.models.findByFilePath(projectId, path)
          if (!model) {
            log.debug("No model found for modified IFC file, skipping", { projectId, path })
            return
          }

          // Fetch the updated IFC data
          const storageKey = getModelStorageKey(projectId, path)
          const obj = await storage.get(storageKey)
          if (!obj) {
            log.warn("IFC file not found in storage after sync", { projectId, path })
            return
          }

          // Regenerate fragment
          try {
            const fragmentData = await ifcProcessor.convert(obj.data)
            const fragmentPath = ifcProcessor.getFragmentPath(path)

            // Delete old fragment if exists and path changed
            if (model.fragmentPath && model.fragmentPath !== fragmentPath) {
              const oldFragmentKey = getModelStorageKey(projectId, model.fragmentPath)
              await storage.delete(oldFragmentKey)
            }

            // Store new fragment
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

            log.info("Fragment regenerated for model", {
              projectId,
              modelId: model.id,
              fragmentPath,
              fragmentSize: fragmentData.byteLength,
            })
          } catch (conversionError) {
            log.warn("Fragment regeneration failed", {
              projectId,
              modelId: model.id,
              error: conversionError,
            })
            // Clear fragment metadata since it's now stale
            await db.models.update(model.id, {
              fragmentPath: null,
              fragmentSize: null,
              fragmentVersion: null,
            })
          }
        } catch (error) {
          log.error("Failed to regenerate fragment", { projectId, path, error })
        }
        break
      }

      case "delete": {
        // IFC file deleted - remove model metadata
        log.info("IFC file deleted, checking for model", { projectId, path })

        try {
          const model = await db.models.findByFilePath(projectId, path)
          if (!model) {
            log.debug("No model found for deleted IFC file, skipping", { projectId, path })
            return
          }

          // Delete fragment from storage if exists
          if (model.fragmentPath) {
            const fragmentStorageKey = getModelStorageKey(projectId, model.fragmentPath)
            await storage.delete(fragmentStorageKey)
          }

          // Delete model metadata
          await db.models.delete(model.id)

          log.info("Model deleted", { projectId, modelId: model.id, name: model.name })
        } catch (error) {
          log.error("Failed to delete model", { projectId, path, error })
        }
        break
      }

      case "move": {
        // IFC file moved - update model path (rare case)
        log.info("IFC file moved", { projectId, from: change.oldPath, to: path })

        if (!change.oldPath) return

        try {
          const model = await db.models.findByFilePath(projectId, change.oldPath)
          if (!model) {
            log.debug("No model found for moved IFC file, skipping", { projectId, path })
            return
          }

          // Note: The IFC file is already at the new location in storage
          // We just need to update the model metadata
          // Fragment path also needs updating
          const newFragmentPath = ifcProcessor.getFragmentPath(path)

          // Move fragment if it exists
          if (model.fragmentPath) {
            const oldFragmentKey = getModelStorageKey(projectId, model.fragmentPath)
            const oldFragment = await storage.get(oldFragmentKey)

            if (oldFragment) {
              const newFragmentKey = getModelStorageKey(projectId, newFragmentPath)
              await storage.put(newFragmentKey, oldFragment.data, {
                contentType: "application/octet-stream",
              })
              await storage.delete(oldFragmentKey)
            }
          }

          // Update model metadata with new paths
          await db.models.update(model.id, {
            filePath: path,
            fragmentPath: model.fragmentPath ? newFragmentPath : null,
          })

          log.info("Model file path updated", {
            projectId,
            modelId: model.id,
            oldPath: change.oldPath,
            newPath: path,
            newFragmentPath: model.fragmentPath ? newFragmentPath : null,
          })
        } catch (error) {
          log.error("Failed to handle moved IFC file", { projectId, path, error })
        }
        break
      }
    }
  }
}
