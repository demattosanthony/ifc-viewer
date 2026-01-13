import { useCallback, useEffect, useRef, useState } from "react"

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
  /** Persist size in localStorage when provided */
  storageKey?: string
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
  storageKey,
  collapseThreshold,
  onCollapse,
  onExpand,
}: UseResizableOptions): UseResizableReturn {
  const clampSize = useCallback(
    (value: number) => Math.max(minSize, Math.min(value, maxSize)),
    [minSize, maxSize]
  )

  const [size, setSize] = useState(() => {
    if (!storageKey || typeof window === "undefined") {
      return initialSize
    }

    const storedSize = window.localStorage.getItem(storageKey)
    if (!storedSize) {
      return initialSize
    }

    const parsedSize = Number.parseFloat(storedSize)
    if (!Number.isFinite(parsedSize)) {
      return initialSize
    }

    return clampSize(parsedSize)
  })
  const [isCollapsed, setIsCollapsed] = useState(false)
  const expandedSizeRef = useRef(size)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    if (!isCollapsed) {
      expandedSizeRef.current = size
    }
  }, [size, isCollapsed])

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(storageKey, String(size))
  }, [size, storageKey])

  const collapse = useCallback(() => {
    setIsCollapsed(true)
    onCollapse?.()
  }, [onCollapse])

  const expand = useCallback(
    (toSize?: number) => {
      setIsCollapsed(false)
      const nextSize = clampSize(toSize ?? expandedSizeRef.current ?? initialSize)
      setSize(nextSize)
      onExpand?.()
    },
    [clampSize, initialSize, onExpand]
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
          setSize(clampSize(newSize))
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
    [size, direction, side, clampSize, collapseThreshold, onCollapse]
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
