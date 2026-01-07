import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  writeFileMutation,
  createDirectoryMutation,
  deleteFileMutation,
  uploadFileMutation,
  getPresignedUrlMutation,
  confirmUploadMutation,
} from "@ifc-viewer/sdk/hooks";
import { formDataBodySerializer } from "@ifc-viewer/sdk";

/** Size threshold for using presigned URL optimization (5MB) */
const PRESIGNED_URL_THRESHOLD = 5 * 1024 * 1024;

interface UseFileOperationsOptions {
  workspaceId: string;
  onRefresh: (path: string) => void;
}

interface DeleteTarget {
  path: string;
  isDirectory: boolean;
}

export function useFileOperations({
  workspaceId,
  onRefresh,
}: UseFileOperationsOptions) {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // SDK mutations
  const writeFile = useMutation({ ...writeFileMutation() });
  const createDirectory = useMutation({ ...createDirectoryMutation() });
  const deleteFile = useMutation({ ...deleteFileMutation() });
  const uploadFileDirect = useMutation({ ...uploadFileMutation() });
  const getPresignedUrl = useMutation({ ...getPresignedUrlMutation() });
  const confirmUpload = useMutation({ ...confirmUploadMutation() });

  /**
   * Upload file via S3 presigned URL (optimization for large files).
   * Returns true if successful, false if presigned URLs not supported.
   */
  const uploadViaPresignedUrl = useCallback(
    async (file: File, path: string): Promise<boolean> => {
      try {
        // Try to get presigned URL
        const presignedData = await getPresignedUrl.mutateAsync({
          path: { id: workspaceId },
          body: {
            path,
            contentType: file.type || "application/octet-stream",
          },
        });

        // Upload directly to S3
        const response = await fetch(presignedData.url, {
          method: presignedData.method,
          headers: presignedData.headers,
          body: file,
        });

        if (!response.ok) {
          throw new Error(`S3 upload failed: ${response.statusText}`);
        }

        // Confirm upload to sync to compute environment
        await confirmUpload.mutateAsync({
          path: { id: workspaceId },
          body: { path },
        });

        return true;
      } catch (error: unknown) {
        // Check if presigned URLs are not supported (501)
        // The SDK throws the error response body: { error: string }
        const errorObj = error as { error?: string };
        if (errorObj?.error?.includes("not supported")) {
          return false;
        }
        throw error;
      }
    },
    [workspaceId, getPresignedUrl, confirmUpload]
  );

  /**
   * Upload a single file with automatic method selection.
   * Uses presigned URL for large files when available, falls back to direct upload.
   */
  const uploadFile = useCallback(
    async (file: File, path: string): Promise<void> => {
      // For large files, try S3 presigned URL first (optimization)
      if (file.size >= PRESIGNED_URL_THRESHOLD) {
        const usedPresigned = await uploadViaPresignedUrl(file, path);
        if (usedPresigned) return;
      }

      // Direct upload using SDK (works with any storage backend)
      // Use formDataBodySerializer to send as multipart/form-data
      await uploadFileDirect.mutateAsync({
        path: { id: workspaceId },
        body: { file, path },
        bodySerializer: formDataBodySerializer.bodySerializer,
        headers: {
          // Remove Content-Type to let browser set it with boundary
          "Content-Type": null as unknown as string,
        },
      });
    },
    [workspaceId, uploadFileDirect, uploadViaPresignedUrl]
  );

  /**
   * Upload multiple files to a target directory.
   */
  const uploadFiles = useCallback(
    async (
      files: FileList,
      targetPath: string = "."
    ): Promise<{ success: number; failed: number }> => {
      const fileArray = Array.from(files);
      setUploadProgress({ current: 0, total: fileArray.length });

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        if (!file) continue;

        const filePath =
          targetPath === "." ? file.name : `${targetPath}/${file.name}`;

        try {
          await uploadFile(file, filePath);
          successCount++;
        } catch (err) {
          failedCount++;
          console.error(`Failed to upload ${file.name}:`, err);
        }

        setUploadProgress({ current: i + 1, total: fileArray.length });
      }

      setUploadProgress(null);
      onRefresh(targetPath);

      return { success: successCount, failed: failedCount };
    },
    [uploadFile, onRefresh]
  );

  /**
   * Create a new file or folder.
   */
  const createItem = useCallback(
    async (
      type: "file" | "folder",
      parentPath: string,
      name: string
    ): Promise<boolean> => {
      if (!name.trim()) return false;

      const newPath =
        parentPath === "." ? name.trim() : `${parentPath}/${name.trim()}`;

      try {
        if (type === "folder") {
          await createDirectory.mutateAsync({
            path: { id: workspaceId },
            body: { path: newPath },
          });
        } else {
          await writeFile.mutateAsync({
            path: { id: workspaceId },
            body: { path: newPath, content: "" },
          });
        }
        onRefresh(parentPath);
        return true;
      } catch (err) {
        console.error("Failed to create:", err);
        return false;
      }
    },
    [workspaceId, onRefresh, writeFile, createDirectory]
  );

  /**
   * Delete a file or directory.
   */
  const deleteItem = useCallback(
    async (path: string, onTabClose?: () => void): Promise<boolean> => {
      try {
        await deleteFile.mutateAsync({
          path: { id: workspaceId },
          query: { path },
        });

        onTabClose?.();

        const parentPath = path.includes("/")
          ? path.substring(0, path.lastIndexOf("/")) || "."
          : ".";
        onRefresh(parentPath);
        return true;
      } catch (err) {
        console.error("Failed to delete:", err);
        return false;
      }
    },
    [workspaceId, onRefresh, deleteFile]
  );

  const initiateDelete = useCallback((path: string, isDirectory: boolean) => {
    setDeleteTarget({ path, isDirectory });
  }, []);

  const confirmDelete = useCallback(
    async (onTabClose?: () => void) => {
      if (!deleteTarget) return;
      await deleteItem(deleteTarget.path, onTabClose);
      setDeleteTarget(null);
    },
    [deleteTarget, deleteItem]
  );

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  return {
    deleteTarget,
    uploadFiles,
    createItem,
    initiateDelete,
    confirmDelete,
    cancelDelete,
    isUploading: uploadProgress !== null || uploadFileDirect.isPending,
    uploadProgress,
    isCreating: writeFile.isPending || createDirectory.isPending,
    isDeleting: deleteFile.isPending,
  };
}
