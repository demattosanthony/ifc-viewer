import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!isInitialized) return;
    if (loadingRef.current) return;
    if (loadedPathRef.current === filePath) return;

    loadingRef.current = true;

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
        console.error("Failed to load IFC:", err);
      } finally {
        loadingRef.current = false;
      }
    };

    load();
  }, [isInitialized, filePath, sessionId, loadModel, unloadAllModels]);

  return null;
}
