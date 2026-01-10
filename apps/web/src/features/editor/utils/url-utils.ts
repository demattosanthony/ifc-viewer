function createTextBlobUrl(content: string, mimeType: string): string {
  const blob = new Blob([content], { type: mimeType })
  return URL.createObjectURL(blob)
}

function normalizeBase64(base64: string): string {
  let normalized = base64.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4
  if (padding) {
    normalized += "=".repeat(4 - padding)
  }
  return normalized
}

function createBinaryBlobUrl(base64Content: string, mimeType: string): string {
  const normalized = normalizeBase64(base64Content)
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}

const MIME_TYPES: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  pdf: "application/pdf",
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  return MIME_TYPES[ext] || "application/octet-stream"
}

export function createViewerUrl(
  content: string,
  contentType: "text" | "binary",
  filename: string
): string {
  const mimeType = getMimeType(filename)

  if (contentType === "binary") {
    return createBinaryBlobUrl(content, mimeType)
  }
  return createTextBlobUrl(content, mimeType)
}
