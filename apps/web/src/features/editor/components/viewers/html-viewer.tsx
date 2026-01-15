import { useBlobUrl } from "../../hooks/use-blob-url"

export interface HtmlViewerProps {
  content: string
  contentType: "text" | "binary"
  filename: string
}

export function HtmlViewer({ content, contentType, filename }: HtmlViewerProps) {
  const { blobUrl, error } = useBlobUrl(content, contentType, filename)

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-red-400">
        <p className="text-sm">Failed to load HTML preview</p>
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
