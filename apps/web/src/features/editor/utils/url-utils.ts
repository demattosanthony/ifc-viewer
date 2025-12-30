/**
 * Create a Blob URL from text content
 */
export function createTextBlobUrl(content: string, mimeType: string): string {
  const blob = new Blob([content], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Convert URL-safe base64 to standard base64
 */
function normalizeBase64(base64: string): string {
  // Replace URL-safe characters with standard base64 characters
  let normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  const padding = normalized.length % 4;
  if (padding) {
    normalized += "=".repeat(4 - padding);
  }
  return normalized;
}

/**
 * Create a Blob URL from base64-encoded binary content
 */
export function createBinaryBlobUrl(
  base64Content: string,
  mimeType: string
): string {
  // Normalize base64 in case it's URL-safe encoded
  const normalized = normalizeBase64(base64Content);
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * MIME type mapping for file extensions
 */
const MIME_TYPES: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  pdf: "application/pdf",
};

/**
 * Get MIME type for a filename
 */
export function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return MIME_TYPES[ext] || "application/octet-stream";
}

/**
 * Create appropriate Blob URL based on content type
 */
export function createViewerUrl(
  content: string,
  contentType: "text" | "binary",
  filename: string
): string {
  const mimeType = getMimeType(filename);

  if (contentType === "binary") {
    return createBinaryBlobUrl(content, mimeType);
  }
  return createTextBlobUrl(content, mimeType);
}
