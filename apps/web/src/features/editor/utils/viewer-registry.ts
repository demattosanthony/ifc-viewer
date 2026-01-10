export type { FileContent, ViewerType } from "./types"

const extensionMap = new Map<string, "ifc" | "html" | "pdf" | "code">([
  ["ifc", "ifc"],
  ["html", "html"],
  ["htm", "html"],
  ["pdf", "pdf"],
])

export function getViewerType(filename: string): "ifc" | "html" | "pdf" | "code" {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  return extensionMap.get(ext) ?? "code"
}
