import { useEffect, useRef, useState } from "react";
import { createViewerUrl } from "../../utils/url-utils";

export interface PdfViewerProps {
  content: string;
  contentType: "text" | "binary";
  filename: string;
}

export function PdfViewer({ content, contentType, filename }: PdfViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      // Revoke previous URL to prevent memory leaks
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }

      const url = createViewerUrl(content, contentType, filename);
      urlRef.current = url;
      setBlobUrl(url);
      setError(null);
    } catch (err) {
      console.error("Failed to create PDF viewer:", err);
      setError("Failed to load PDF");
    }

    // Cleanup on unmount
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, [content, contentType, filename]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-red-400">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-[#858585]">
        <p className="text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <object
      data={blobUrl}
      type="application/pdf"
      className="w-full h-full"
      title={`PDF: ${filename}`}
    >
      {/* Fallback for browsers that don't support embedded PDF */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#1e1e1e] text-[#858585] gap-4 h-full">
        <p className="text-sm">PDF preview not supported in this browser</p>
        <a
          href={blobUrl}
          download={filename}
          className="px-4 py-2 bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors"
        >
          Download PDF
        </a>
      </div>
    </object>
  );
}
