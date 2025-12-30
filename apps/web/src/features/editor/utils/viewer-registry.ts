import type { ViewerType, ViewerConfig, ContentEncoding } from "./types";

export type { ViewerType, ViewerConfig, ContentEncoding, FileContent } from "./types";

// Central registry of all viewer configurations
const VIEWER_REGISTRY: ViewerConfig[] = [
  {
    type: "ifc",
    extensions: ["ifc"],
    contentEncoding: "binary",
    label: "IFC Viewer",
  },
  {
    type: "html",
    extensions: ["html", "htm"],
    contentEncoding: "text",
    label: "HTML Preview",
  },
  {
    type: "pdf",
    extensions: ["pdf"],
    contentEncoding: "binary",
    label: "PDF Viewer",
  },
  {
    type: "code",
    extensions: [], // Fallback - handles all other extensions
    contentEncoding: "text",
    label: "Code Editor",
  },
];

// Build extension -> viewer type lookup map
const extensionMap = new Map<string, ViewerType>();
for (const config of VIEWER_REGISTRY) {
  for (const ext of config.extensions) {
    extensionMap.set(ext.toLowerCase(), config.type);
  }
}

/**
 * Determine viewer type from filename
 */
export function getViewerType(filename: string): ViewerType {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return extensionMap.get(ext) ?? "code";
}

// Default code config (always present as fallback)
const CODE_CONFIG = VIEWER_REGISTRY.find((c) => c.type === "code")!;

/**
 * Get viewer configuration by type
 */
export function getViewerConfig(type: ViewerType): ViewerConfig {
  return VIEWER_REGISTRY.find((c) => c.type === type) ?? CODE_CONFIG;
}

/**
 * Get content encoding for a file (determines how to fetch/store content)
 */
export function getContentEncoding(filename: string): ContentEncoding {
  const type = getViewerType(filename);
  return getViewerConfig(type).contentEncoding;
}

/**
 * Check if viewer type requires binary content handling
 */
export function isBinaryViewer(type: ViewerType): boolean {
  return getViewerConfig(type).contentEncoding === "binary";
}
