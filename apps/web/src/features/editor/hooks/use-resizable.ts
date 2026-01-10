import { useCallback, useRef, useState } from "react"

type Direction = "horizontal" | "vertical"
type Side = "left" | "right" | "top" | "bottom"

interface UseResizableOptions {
  initialSize: number
  minSize: number
  maxSize: number
  direction: Direction
  /** Which side the panel is on. Affects drag direction calculation.
   * - "left": drag right to grow (default for horizontal)
   * - "right": drag left to grow
   * - "top": drag down to grow
   * - "bottom": drag up to grow (default for vertical)
   */
  side?: Side
  /** For horizontal: collapse when dragged below threshold. For vertical: no collapse behavior */
  collapseThreshold?: number
  onCollapse?: () => void
  onExpand?: () => void
}

interface UseResizableReturn {
  size: number
  setSize: (size: number) => void
  isCollapsed: boolean
  collapse: () => void
  expand: (toSize?: number) => void
  handleResizeStart: (e: React.MouseEvent) => void
}

export function useResizable({
  initialSize,
  minSize,
  maxSize,
  direction,
  side,
  collapseThreshold,
  onCollapse,
  onExpand,
}: UseResizableOptions): UseResizableReturn {
  const [size, setSize] = useState(initialSize)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const isDraggingRef = useRef(false)

  const collapse = useCallback(() => {
    setIsCollapsed(true)
    onCollapse?.()
  }, [onCollapse])

  const expand = useCallback(
    (toSize?: number) => {
      setIsCollapsed(false)
      setSize(toSize ?? initialSize)
      onExpand?.()
    },
    [initialSize, onExpand]
  )

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDraggingRef.current = true

      const startPos = direction === "horizontal" ? e.clientX : e.clientY
      const startSize = size
      const cursor = direction === "horizontal" ? "ew-resize" : "ns-resize"

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return
        moveEvent.preventDefault()

        const currentPos = direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY

        // Calculate delta based on panel side
        // - left panel: drag right to grow (positive delta)
        // - right panel: drag left to grow (negative delta inverted)
        // - bottom panel: drag up to grow (negative delta inverted)
        // - top panel: drag down to grow (positive delta)
        const rawDelta = currentPos - startPos
        const effectiveSide = side ?? (direction === "horizontal" ? "left" : "bottom")
        const delta = effectiveSide === "right" || effectiveSide === "bottom" ? -rawDelta : rawDelta

        const newSize = startSize + delta

        // Handle collapse threshold for horizontal panels
        if (direction === "horizontal" && collapseThreshold && newSize < collapseThreshold) {
          setIsCollapsed(true)
          onCollapse?.()
        } else {
          setIsCollapsed(false)
          setSize(Math.max(minSize, Math.min(newSize, maxSize)))
        }
      }

      const handleMouseUp = () => {
        isDraggingRef.current = false
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }

      document.body.style.cursor = cursor
      document.body.style.userSelect = "none"
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [size, direction, side, minSize, maxSize, collapseThreshold, onCollapse]
  )

  return {
    size,
    setSize,
    isCollapsed,
    collapse,
    expand,
    handleResizeStart,
  }
}
