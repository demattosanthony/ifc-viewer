import { useState, useCallback, useRef } from "react";

type Direction = "horizontal" | "vertical";

interface UseResizableOptions {
  initialSize: number;
  minSize: number;
  maxSize: number;
  direction: Direction;
  /** For horizontal: collapse when dragged below threshold. For vertical: no collapse behavior */
  collapseThreshold?: number;
  onCollapse?: () => void;
  onExpand?: () => void;
}

interface UseResizableReturn {
  size: number;
  setSize: (size: number) => void;
  isCollapsed: boolean;
  collapse: () => void;
  expand: (toSize?: number) => void;
  handleResizeStart: (e: React.MouseEvent) => void;
}

export function useResizable({
  initialSize,
  minSize,
  maxSize,
  direction,
  collapseThreshold,
  onCollapse,
  onExpand,
}: UseResizableOptions): UseResizableReturn {
  const [size, setSize] = useState(initialSize);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isDraggingRef = useRef(false);

  const collapse = useCallback(() => {
    setIsCollapsed(true);
    onCollapse?.();
  }, [onCollapse]);

  const expand = useCallback(
    (toSize?: number) => {
      setIsCollapsed(false);
      setSize(toSize ?? initialSize);
      onExpand?.();
    },
    [initialSize, onExpand]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;

      const startPos = direction === "horizontal" ? e.clientX : e.clientY;
      const startSize = size;
      const cursor = direction === "horizontal" ? "ew-resize" : "ns-resize";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        moveEvent.preventDefault();

        const currentPos =
          direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
        // For horizontal (sidebar): positive delta = grow right
        // For vertical (terminal): negative delta = grow up (since we drag from top edge)
        const delta =
          direction === "horizontal"
            ? currentPos - startPos
            : startPos - currentPos;

        const newSize = startSize + delta;

        // Handle collapse threshold for horizontal panels
        if (
          direction === "horizontal" &&
          collapseThreshold &&
          newSize < collapseThreshold
        ) {
          setIsCollapsed(true);
          onCollapse?.();
        } else {
          setIsCollapsed(false);
          setSize(Math.max(minSize, Math.min(newSize, maxSize)));
        }
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = cursor;
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [size, direction, minSize, maxSize, collapseThreshold, onCollapse]
  );

  return {
    size,
    setSize,
    isCollapsed,
    collapse,
    expand,
    handleResizeStart,
  };
}
