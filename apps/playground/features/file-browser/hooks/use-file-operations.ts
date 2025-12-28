import { useState, useCallback } from "react";
import { api } from "@/.bunbox/api-client";

interface UseFileOperationsOptions {
  sessionId: string;
  onRefresh: (path: string) => void;
}

interface DeleteTarget {
  path: string;
  isDirectory: boolean;
}

export function useFileOperations({
  sessionId,
  onRefresh,
}: UseFileOperationsOptions) {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

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
            await api.sessions.files.content.writeFile({
              id: sessionId,
              path: filePath,
              content: base64,
              encoding: "base64",
            });
            onRefresh(targetPath);
          } catch (err) {
            console.error("Failed to upload file:", err);
          }
        };
        reader.readAsDataURL(file);
      }
    },
    [sessionId, onRefresh]
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
          await api.sessions.files.createDirectory({
            id: sessionId,
            path: newPath,
          });
        } else {
          await api.sessions.files.content.writeFile({
            id: sessionId,
            path: newPath,
            content: "",
            encoding: "text",
          });
        }
        onRefresh(parentPath);
        return true;
      } catch (err) {
        console.error("Failed to create:", err);
        return false;
      }
    },
    [sessionId, onRefresh]
  );

  const deleteItem = useCallback(
    async (path: string, onTabClose?: () => void): Promise<boolean> => {
      try {
        await api.sessions.files.deleteFile({
          id: sessionId,
          path,
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
    [sessionId, onRefresh]
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
  };
}
