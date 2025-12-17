import { useEffect } from "react";
import { useViewer } from "../context/viewer-context";
import * as OBF from "@thatopen/components-front";
import * as OBC from "@thatopen/components";
import type { ElementSelectedEvent, ElementHoveredEvent } from "../types";

export interface UseViewerEventsOptions {
  onElementSelected?: (event: ElementSelectedEvent) => void;
}

export function useViewerEvents(options: UseViewerEventsOptions) {
  const { components, isInitialized } = useViewer();

  useEffect(() => {
    if (!components || !isInitialized || !options.onElementSelected) return;

    try {
      const highlighter = components.get(OBF.Highlighter);
      const selectName = highlighter.config.selectName;

      const highlightHandler = (data: OBC.ModelIdMap) =>
        options.onElementSelected?.({ modelIdMap: data });
      const clearHandler = () =>
        options.onElementSelected?.({ modelIdMap: {} });

      highlighter.events[selectName]?.onHighlight.add(highlightHandler);
      highlighter.events[selectName]?.onClear.add(clearHandler);

      return () => {
        highlighter.events[selectName]?.onHighlight.remove(highlightHandler);
        highlighter.events[selectName]?.onClear.remove(clearHandler);
      };
    } catch (e) {
      console.warn("Highlighter not available:", e);
    }
  }, [components, isInitialized, options.onElementSelected]);
}
