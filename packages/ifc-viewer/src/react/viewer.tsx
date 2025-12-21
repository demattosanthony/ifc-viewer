import { useViewer } from "./context";
import type { ViewerProps } from "./types";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";

export function Viewer({ onReady, onError }: ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { initialize, isInitialized, error, camera, resize } = useViewer();
  const hasInitialized = useRef(false);

  const styles = useMemo<CSSProperties>(
    () => ({
      width: "100%",
      height: "100%",
      position: "relative",
      overflow: "hidden",
      cursor: camera?.cursor ?? "default",
    }),
    [camera?.cursor]
  );

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

  // Watch container for resize events and trigger renderer resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isInitialized) return;

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isInitialized, resize]);

  return <div ref={containerRef} style={styles}></div>;
}
