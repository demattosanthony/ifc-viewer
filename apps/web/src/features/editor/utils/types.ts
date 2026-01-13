export type ViewerType = "code" | "ifc" | "html" | "pdf" | "unsupported"

export interface FileContent {
  type: "text" | "binary"
  content: string
}
