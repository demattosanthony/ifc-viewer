import { useViewer } from "./context";
import type { ViewerProps } from "./types";
import { useEffect, useRef, type CSSProperties } from "react";

const defaultStyles: CSSProperties = {
  width: "100%",
  height: "100%",
  position: "relative",
  overflow: "hidden",
};

export function Viewer({ onReady, onError }: ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { initialize, isInitialized, error } = useViewer();
  const hasInitialized = useRef(false);

  // Init the viewer when the container mounts
  useEffect(() => {
    const container = containerRef.current;
    if (!container || hasInitialized.current) return;

    hasInitialized.current = true;
    initialize(container).catch((error) => {
      onError?.(error);
    });
  }, [initialize, onError]);

  // Notify when ready
  useEffect(() => {
    if (isInitialized) {
      onReady?.();
    }
  }, [isInitialized, onReady]);

  // Notify on errors
  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  return <div ref={containerRef} style={defaultStyles}></div>;
}
