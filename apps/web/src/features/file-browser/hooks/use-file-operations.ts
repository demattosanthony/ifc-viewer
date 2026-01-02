import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  writeFileMutation,
  createDirectoryMutation,
  deleteFileMutation,
} from "@ifc-viewer/sdk/hooks";

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

  const writeFile = useMutation({
    ...writeFileMutation(),
  });

  const createDirectory = useMutation({
    ...createDirectoryMutation(),
  });

  const deleteFile = useMutation({
    ...deleteFileMutation(),
  });

  const uploadFiles = useCallback(
    async (files: FileList, targetPath: string = ".") => {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onload = async () => {
          const content = reader.result as string;
          const base64 = content.split(",")[1] || "";
          const filePath =
            targetPath === "." ? file.name : `${targetPath}/${file.name}`;

          try {
            await writeFile.mutateAsync({
              path: { id: workspaceId },
              body: { path: filePath, content: base64, isBinary: true },
            });
            onRefresh(targetPath);
          } catch (err) {
            console.error("Failed to upload file:", err);
          }
        };
        reader.readAsDataURL(file);
      }
    },
    [workspaceId, onRefresh, writeFile]
  );

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

  const initiateDelete = useCallback(
    (path: string, isDirectory: boolean) => {
      setDeleteTarget({ path, isDirectory });
    },
    []
  );

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
    isUploading: writeFile.isPending,
    isCreating:
      writeFile.isPending || createDirectory.isPending,
    isDeleting: deleteFile.isPending,
  };
}
