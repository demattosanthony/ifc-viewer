import { Markdown } from "@ifc-viewer/ui/components"

export interface MarkdownViewerProps {
  content: string
  contentType: "text" | "binary"
  filename: string
}

export function MarkdownViewer({ content, contentType }: MarkdownViewerProps) {
  // Handle binary content (unlikely for markdown, but for consistency)
  const markdownContent = contentType === "binary" ? atob(content) : content

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-4xl mx-auto px-8 py-6">
        <Markdown>{markdownContent}</Markdown>
      </div>
    </div>
  )
}
