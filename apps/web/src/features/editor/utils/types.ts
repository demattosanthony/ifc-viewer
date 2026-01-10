export type ViewerType = "code" | "ifc" | "html" | "pdf"

export interface FileContent {
  type: "text" | "binary"
  content: string
}
