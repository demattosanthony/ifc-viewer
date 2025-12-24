// Extensible viewer type - add new types here
export type ViewerType = "code" | "ifc" | "html" | "pdf";

// Content handling classification
export type ContentEncoding = "text" | "binary";

// Viewer configuration for registry
export interface ViewerConfig {
  type: ViewerType;
  extensions: string[];
  contentEncoding: ContentEncoding;
  label: string;
}

// File content from context
export interface FileContent {
  type: "text" | "binary";
  content: string;
}
