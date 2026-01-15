import { useEffect, useRef, useState } from "react"
import { createViewerUrl } from "../utils/url-utils"

export function useBlobUrl(content: string, contentType: "text" | "binary", filename: string) {
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
      console.error("Failed to create blob URL:", err)
      setError("Failed to load content")
    }

    // Cleanup on unmount
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
      }
    }
  }, [content, contentType, filename])

  return { blobUrl, error }
}
