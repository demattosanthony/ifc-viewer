import { useEffect, useRef, useState } from "react";
import { useViewer } from "ifc-viewer";
import { api } from "@/.bunbox/api-client";

export interface IFCViewerProps {
  sessionId: string;
  filePath: string;
}

export function IFCViewer({ sessionId, filePath }: IFCViewerProps) {
  const { loadModel, unloadAllModels, isInitialized } = useViewer();
  const loadedPathRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized) return;
    if (loadingRef.current) return;
    if (loadedPathRef.current === filePath) return;

    loadingRef.current = true;
    setError(null);

    const load = async () => {
      try {
        await unloadAllModels();

        const data = (await api.sessions.files.content.readFile({
          id: sessionId,
          path: filePath,
        })) as { type: string; content: string; path: string };

        let buffer: ArrayBuffer;
        if (data.type === "binary") {
          const binary = atob(data.content);
          buffer = new ArrayBuffer(binary.length);
          const view = new Uint8Array(buffer);
          for (let i = 0; i < binary.length; i++) {
            view[i] = binary.charCodeAt(i);
          }
        } else {
          const encoder = new TextEncoder();
          buffer = encoder.encode(data.content).buffer;
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
  }, [isInitialized, filePath, sessionId, loadModel, unloadAllModels]);

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
