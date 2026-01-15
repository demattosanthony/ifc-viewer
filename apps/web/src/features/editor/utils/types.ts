export type ViewerType = "code" | "ifc" | "html" | "pdf" | "markdown" | "unsupported"

export interface FileContent {
  type: "text" | "binary"
  content: string
}
