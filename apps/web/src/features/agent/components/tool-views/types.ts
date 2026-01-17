// Shared types for tool view components

export interface ToolViewProps {
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  isStreaming: boolean
  isComplete?: boolean
  error?: string
}

// ============================================================================
// Tool Name Constants and Helpers
// ============================================================================

/** Tool name aliases - all variations that map to the same tool type */
export const TOOL_NAMES = {
  writeFile: ["write_file", "writeFile"],
  readFile: ["read_file", "readFile"],
  executeCommand: ["executeCommand", "shell_execute"],
  executePython: ["executePython"],
  executeViewer: ["executeViewer"],
} as const

export type ToolType = keyof typeof TOOL_NAMES

/** Check if a tool name matches a specific tool type */
export function isToolName(name: string, tool: ToolType): boolean {
  return (TOOL_NAMES[tool] as readonly string[]).includes(name)
}

/** Get the canonical tool type from any alias */
export function getToolType(name: string): ToolType | undefined {
  for (const [toolType, aliases] of Object.entries(TOOL_NAMES)) {
    if ((aliases as readonly string[]).includes(name)) {
      return toolType as ToolType
    }
  }
  return undefined
}

// ============================================================================
// File Utilities
// ============================================================================

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

// ============================================================================
// Output Formatting
// ============================================================================

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

/** Clean up shell output for display - remove prompt lines and common noise */
export function cleanShellOutput(output: string): string {
  return output
    .split("\n")
    .filter((line) => {
      // Remove prompt lines
      if (line.includes("/workspace $") || line.includes("/workspace$")) {
        return false
      }
      // Remove command echo with marker
      if (line.includes("<<CMD_DONE:")) {
        return false
      }
      return true
    })
    .join("\n")
    .trim()
}

/** Format viewer output for display */
export function formatViewerOutput(output: Record<string, unknown>): string {
  // Check for success/result pattern from our API
  if ("success" in output) {
    if (output.success === false) {
      return output.error ? String(output.error) : "Execution failed"
    }
    if ("result" in output && output.result !== undefined) {
      return formatValue(output.result)
    }
  }

  return formatValue(output)
}

/** Generate a title based on viewer code content */
export function generateViewerTitle(code: string): string {
  if (code.includes("getAvailableModels")) return "Getting available models"
  if (code.includes("getLoadedModels")) return "Getting loaded models"
  if (code.includes("loadModel")) return "Loading model"
  if (code.includes("unloadModel")) return "Unloading model"
  if (code.includes("getHierarchy")) return "Getting hierarchy"
  if (code.includes("getChildren")) return "Getting children"
  if (code.includes("getElement")) return "Getting element details"
  if (code.includes("select")) return "Selecting elements"
  if (code.includes("clearSelection")) return "Clearing selection"
  if (code.includes("getPlans")) return "Getting floor plans"
  if (code.includes("openPlan")) return "Opening floor plan"
  if (code.includes("closePlan")) return "Closing floor plan"
  return "Viewer action"
}
