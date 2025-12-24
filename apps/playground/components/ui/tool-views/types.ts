// Shared types for tool view components

export interface ToolViewProps {
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  isStreaming: boolean
  isComplete?: boolean
  error?: string
}

// Map file extension to Shiki language
export function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || ""
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    rb: "ruby",
    rs: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    c: "c",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    r: "r",
    sql: "sql",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    ps1: "powershell",
    yml: "yaml",
    yaml: "yaml",
    json: "json",
    xml: "xml",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    md: "markdown",
    mdx: "mdx",
    vue: "vue",
    svelte: "svelte",
    dockerfile: "dockerfile",
    toml: "toml",
    ini: "ini",
    env: "bash",
    gitignore: "gitignore",
    makefile: "makefile",
    ifc: "text",
  }
  return langMap[ext] || "text"
}

// Get file name from path
export function getFileName(path: string): string {
  return path.split("/").pop() || path
}

// Format unknown value for display
export function formatValue(value: unknown): string {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (typeof value === "string") return value
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}
