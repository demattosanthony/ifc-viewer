import { useEffect, useRef, useState } from "react"
import { createViewerUrl } from "../../utils/url-utils"

export interface HtmlViewerProps {
  content: string
  contentType: "text" | "binary"
  filename: string
}

export function HtmlViewer({ content, contentType, filename }: HtmlViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    try {
      // Revoke previous URL to prevent memory leaks
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
      }

      const url = createViewerUrl(content, contentType, filename)
      urlRef.current = url
      setBlobUrl(url)
      setError(null)
    } catch (err) {
      console.error("Failed to create HTML preview:", err)
      setError("Failed to load HTML preview")
    }

    // Cleanup on unmount
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
      }
    }
  }, [content, contentType, filename])

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-red-400">
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (!blobUrl) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-[#858585]">
        <p className="text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <iframe
      src={blobUrl}
      className="w-full h-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin"
      title={`HTML Preview: ${filename}`}
    />
  )
}
