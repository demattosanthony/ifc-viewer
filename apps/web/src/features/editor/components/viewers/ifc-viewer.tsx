import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useViewer } from "@ifc-viewer/viewer";
import { listModels, readProjectFile } from "@ifc-viewer/sdk";
import { listModelsQueryKey } from "@ifc-viewer/sdk/hooks";

/** Get the API base URL for direct fetch calls */
function getApiBaseUrl(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return "http://localhost:3000";
}

export interface IFCViewerProps {
  projectId: string;
  filePath: string;
}

export function IFCViewer({ projectId, filePath }: IFCViewerProps) {
  const { loadModel, unloadAllModels, isInitialized } = useViewer();
  const loadedPathRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Query for models list to find the model by filePath
  const modelsQuery = useQuery({
    queryKey: listModelsQueryKey({ path: { id: projectId } }),
    queryFn: async () => {
      const { data } = await listModels({ path: { id: projectId } });
      return data ?? [];
    },
    staleTime: 60_000, // Models list changes infrequently
  });

  // Find the model matching this filePath
  const model = useMemo(() => {
    if (!modelsQuery.data) return null;
    return modelsQuery.data.find((m) => m.filePath === filePath) ?? null;
  }, [modelsQuery.data, filePath]);

  // Query for IFC file content - uses Models API if model is found, else falls back to file API
  const contentQuery = useQuery({
    queryKey: ["ifc-content", projectId, filePath, model?.id],
    queryFn: async () => {
      if (model) {
        // Use Models API - fetch raw binary directly
        // Note: Using fetch() directly here as it returns binary data (not JSON)
        const response = await fetch(
          `${getApiBaseUrl()}/api/projects/${projectId}/models/${model.id}/file`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch model file: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        return { type: "binary" as const, buffer };
      } else {
        // Fall back to file API for unregistered IFC files
        const { data } = await readProjectFile({
          path: { id: projectId },
          query: { path: filePath },
        });
        return { type: "file-api" as const, data };
      }
    },
    enabled:
      isInitialized &&
      loadedPathRef.current !== filePath &&
      modelsQuery.isSuccess,
    staleTime: Infinity, // IFC files are large, don't refetch
  });

  // Load the model when content is available
  useEffect(() => {
    if (!isInitialized) return;
    if (loadingRef.current) return;
    if (loadedPathRef.current === filePath) return;
    if (!contentQuery.data) return;

    loadingRef.current = true;
    setError(null);

    const load = async () => {
      try {
        await unloadAllModels();

        const result = contentQuery.data;
        let buffer: ArrayBuffer;

        if (result.type === "binary") {
          // Models API returns ArrayBuffer directly
          buffer = result.buffer;
        } else if (result.data?.type === "binary") {
          // File API returns base64 encoded binary
          const binary = atob(result.data.content ?? "");
          buffer = new ArrayBuffer(binary.length);
          const view = new Uint8Array(buffer);
          for (let i = 0; i < binary.length; i++) {
            view[i] = binary.charCodeAt(i);
          }
        } else {
          // File API returns text content
          const encoder = new TextEncoder();
          buffer = encoder.encode(result.data?.content ?? "").buffer;
        }

        const filename = filePath.split("/").pop() || "model.ifc";
        await loadModel(buffer, filename);
        loadedPathRef.current = filePath;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Failed to load IFC:", err);
        setError(`Failed to load model: ${message}`);
      } finally {
        loadingRef.current = false;
      }
    };

    load();
  }, [isInitialized, filePath, contentQuery.data, loadModel, unloadAllModels]);

  // Handle query errors
  useEffect(() => {
    if (contentQuery.error) {
      const message =
        contentQuery.error instanceof Error
          ? contentQuery.error.message
          : "Unknown error";
      setError(`Failed to load model: ${message}`);
    }
  }, [contentQuery.error]);

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm max-w-md text-center">
          {error}
        </div>
      </div>
    );
  }

  return null;
}
