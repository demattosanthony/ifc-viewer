import { formDataBodySerializer } from "@ifc-viewer/sdk"
import {
  confirmProjectUploadMutation,
  createProjectDirectoryMutation,
  deleteProjectFileMutation,
  getProjectPresignedUrlMutation,
  listModelsQueryKey,
  uploadModelMutation,
  uploadProjectFileMutation,
  writeProjectFileMutation,
} from "@ifc-viewer/sdk/hooks"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"

/** Check if a file is an IFC model based on extension */
function isIfcFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(".ifc")
}

/** Size threshold for using presigned URL optimization (5MB) */
const PRESIGNED_URL_THRESHOLD = 5 * 1024 * 1024

interface UseFileOperationsOptions {
  projectId: string
  onRefresh: (path: string) => void
}

interface DeleteTarget {
  path: string
  isDirectory: boolean
}

export function useFileOperations({ projectId, onRefresh }: UseFileOperationsOptions) {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{
    current: number
    total: number
  } | null>(null)
  const queryClient = useQueryClient()

  // SDK mutations - use project-based endpoints
  const writeFile = useMutation({ ...writeProjectFileMutation() })
  const createDirectory = useMutation({ ...createProjectDirectoryMutation() })
  const deleteFile = useMutation({ ...deleteProjectFileMutation() })
  const uploadFileDirect = useMutation({ ...uploadProjectFileMutation() })
  const getPresignedUrl = useMutation({ ...getProjectPresignedUrlMutation() })
  const confirmUpload = useMutation({ ...confirmProjectUploadMutation() })
  const uploadModel = useMutation({ ...uploadModelMutation() })

  /**
   * Upload file via S3 presigned URL (optimization for large files).
   * Returns true if successful, false if presigned URLs not supported.
   */
  const uploadViaPresignedUrl = useCallback(
    async (file: File, path: string): Promise<boolean> => {
      try {
        // Try to get presigned URL
        const presignedData = await getPresignedUrl.mutateAsync({
          path: { id: projectId },
          body: {
            path,
            contentType: file.type || "application/octet-stream",
          },
        })

        // Upload directly to S3
        const response = await fetch(presignedData.url, {
          method: presignedData.method,
          headers: presignedData.headers,
          body: file,
        })

        if (!response.ok) {
          throw new Error(`S3 upload failed: ${response.statusText}`)
        }

        // Confirm upload
        await confirmUpload.mutateAsync({
          path: { id: projectId },
          body: { path },
        })

        return true
      } catch (error: unknown) {
        // Check if presigned URLs are not supported (501)
        // The SDK throws the error response body: { error: string }
        const errorObj = error as { error?: string }
        if (errorObj?.error?.includes("not supported")) {
          return false
        }
        throw error
      }
    },
    [projectId, getPresignedUrl, confirmUpload]
  )

  /**
   * Upload an IFC file via the Models API.
   * IFC files are tracked as models with metadata and stored in models/ directory.
   */
  const uploadIfcModel = useCallback(
    async (file: File): Promise<void> => {
      // Extract name from filename (without extension)
      const name = file.name.replace(/\.ifc$/i, "")

      await uploadModel.mutateAsync({
        path: { id: projectId },
        body: { file, name },
        bodySerializer: formDataBodySerializer.bodySerializer,
        headers: {
          "Content-Type": null as unknown as string,
        },
      })

      await queryClient.invalidateQueries({
        queryKey: listModelsQueryKey({ path: { id: projectId } }),
      })
    },
    [projectId, queryClient, uploadModel]
  )

  /**
   * Upload a single file with automatic method selection.
   * - IFC files are routed to Models API (stored in models/ directory)
   * - Large files use presigned URL when available
   * - Other files use direct upload
   */
  const uploadFile = useCallback(
    async (file: File, path: string): Promise<void> => {
      // Route IFC files to Models API
      if (isIfcFile(file.name)) {
        await uploadIfcModel(file)
        return
      }

      // For large files, try S3 presigned URL first (optimization)
      if (file.size >= PRESIGNED_URL_THRESHOLD) {
        const usedPresigned = await uploadViaPresignedUrl(file, path)
        if (usedPresigned) return
      }

      // Direct upload using SDK (works with any storage backend)
      // Use formDataBodySerializer to send as multipart/form-data
      await uploadFileDirect.mutateAsync({
        path: { id: projectId },
        body: { file, path },
        bodySerializer: formDataBodySerializer.bodySerializer,
        headers: {
          // Remove Content-Type to let browser set it with boundary
          "Content-Type": null as unknown as string,
        },
      })
    },
    [projectId, uploadFileDirect, uploadViaPresignedUrl, uploadIfcModel]
  )

  /**
   * Upload multiple files to a target directory.
   * IFC files are automatically routed to the Models API and stored in models/.
   */
  const uploadFiles = useCallback(
    async (
      files: FileList,
      targetPath: string = "."
    ): Promise<{ success: number; failed: number }> => {
      const fileArray = Array.from(files)
      setUploadProgress({ current: 0, total: fileArray.length })

      let successCount = 0
      let failedCount = 0
      let hasIfcFiles = false

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]
        if (!file) continue

        if (isIfcFile(file.name)) {
          hasIfcFiles = true
        }

        const filePath = targetPath === "." ? file.name : `${targetPath}/${file.name}`

        try {
          await uploadFile(file, filePath)
          successCount++
        } catch (err) {
          failedCount++
          console.error(`Failed to upload ${file.name}:`, err)
        }

        setUploadProgress({ current: i + 1, total: fileArray.length })
      }

      setUploadProgress(null)

      // Refresh target directory and models/ if IFC files were uploaded
      onRefresh(targetPath)
      if (hasIfcFiles && targetPath !== "models") {
        onRefresh("models")
      }

      return { success: successCount, failed: failedCount }
    },
    [uploadFile, onRefresh]
  )

  /**
   * Create a new file or folder.
   */
  const createItem = useCallback(
    async (type: "file" | "folder", parentPath: string, name: string): Promise<boolean> => {
      if (!name.trim()) return false

      const newPath = parentPath === "." ? name.trim() : `${parentPath}/${name.trim()}`

      try {
        if (type === "folder") {
          await createDirectory.mutateAsync({
            path: { id: projectId },
            body: { path: newPath },
          })
        } else {
          await writeFile.mutateAsync({
            path: { id: projectId },
            body: { path: newPath, content: "" },
          })
        }
        onRefresh(parentPath)
        return true
      } catch (err) {
        console.error("Failed to create:", err)
        return false
      }
    },
    [projectId, onRefresh, writeFile, createDirectory]
  )

  /**
   * Delete a file or directory.
   */
  const deleteItem = useCallback(
    async (path: string, onTabClose?: () => void): Promise<boolean> => {
      try {
        await deleteFile.mutateAsync({
          path: { id: projectId },
          query: { path },
        })

        onTabClose?.()

        if (isIfcFile(path) || path === "models" || path.startsWith("models/")) {
          await queryClient.invalidateQueries({
            queryKey: listModelsQueryKey({ path: { id: projectId } }),
          })
        }

        const parentPath = path.includes("/")
          ? path.substring(0, path.lastIndexOf("/")) || "."
          : "."
        onRefresh(parentPath)
        return true
      } catch (err) {
        console.error("Failed to delete:", err)
        return false
      }
    },
    [projectId, onRefresh, deleteFile, queryClient]
  )

  const initiateDelete = useCallback((path: string, isDirectory: boolean) => {
    setDeleteTarget({ path, isDirectory })
  }, [])

  const confirmDelete = useCallback(
    async (onTabClose?: () => void) => {
      if (!deleteTarget) return
      await deleteItem(deleteTarget.path, onTabClose)
      setDeleteTarget(null)
    },
    [deleteTarget, deleteItem]
  )

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null)
  }, [])

  return {
    deleteTarget,
    uploadFiles,
    createItem,
    initiateDelete,
    confirmDelete,
    cancelDelete,
    isUploading: uploadProgress !== null || uploadFileDirect.isPending || uploadModel.isPending,
    uploadProgress,
    isCreating: writeFile.isPending || createDirectory.isPending,
    isDeleting: deleteFile.isPending,
  }
}
