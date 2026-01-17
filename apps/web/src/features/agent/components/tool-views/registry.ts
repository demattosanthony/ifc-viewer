import { Box, Code2, File, type LucideIcon, Terminal } from "lucide-react"
import { generateViewerTitle, getFileName, getToolType, type ToolType } from "./types"

// ============================================================================
// Tool Configuration
// ============================================================================

export interface ToolConfig {
  /** All name aliases for this tool */
  names: readonly string[]
  /** Icon to display for this tool */
  icon: LucideIcon
  /** Generate the display title from input */
  getTitle: (input: Record<string, unknown>) => string
  /** Optional right-side label (e.g., filename) */
  getRightLabel?: (input: Record<string, unknown>) => string | null
  /** Language for code display */
  codeLanguage?: string
  /** Loading text to display */
  loadingText?: string
}

// ============================================================================
// Tool Registry
// ============================================================================

export const TOOL_REGISTRY: Record<ToolType, ToolConfig> = {
  writeFile: {
    names: ["write_file", "writeFile"],
    icon: File,
    getTitle: (input) => `Writing ${input.path || "file"}`,
    getRightLabel: (input) => (typeof input.path === "string" ? getFileName(input.path) : null),
  },
  readFile: {
    names: ["read_file", "readFile"],
    icon: File,
    getTitle: (input) => `Read ${input.path || "file"}`,
    getRightLabel: (input) => (typeof input.path === "string" ? getFileName(input.path) : null),
  },
  executeCommand: {
    names: ["executeCommand", "shell_execute"],
    icon: Terminal,
    getTitle: (input) => {
      if (typeof input.title === "string") return input.title
      const cmd = typeof input.command === "string" ? input.command : ""
      return cmd.length > 40 ? `${cmd.slice(0, 40)}...` : cmd || "Running command"
    },
    loadingText: "Running...",
  },
  executePython: {
    names: ["executePython"],
    icon: Code2,
    getTitle: (input) => (typeof input.title === "string" ? input.title : "Ran code"),
    codeLanguage: "python",
    loadingText: "Running...",
  },
  executeViewer: {
    names: ["executeViewer"],
    icon: Box,
    getTitle: (input) => {
      const code = typeof input.code === "string" ? input.code : ""
      return generateViewerTitle(code)
    },
    codeLanguage: "javascript",
    loadingText: "Executing in viewer...",
  },
}

// ============================================================================
// Registry Helpers
// ============================================================================

/** Get tool configuration by name */
export function getToolConfig(name: string): ToolConfig | undefined {
  const toolType = getToolType(name)
  return toolType ? TOOL_REGISTRY[toolType] : undefined
}

/** Get tool icon by name */
export function getToolIcon(name: string): LucideIcon {
  const config = getToolConfig(name)
  return config?.icon ?? Terminal
}

/** Get display title for a tool */
export function getToolTitle(name: string, input: Record<string, unknown>): string {
  const config = getToolConfig(name)
  if (config) {
    return config.getTitle(input)
  }
  // Fallback: convert camelCase/snake_case to readable
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
}

/** Get right label for a tool (e.g., filename) */
export function getToolRightLabel(name: string, input: Record<string, unknown>): string | null {
  const config = getToolConfig(name)
  return config?.getRightLabel?.(input) ?? null
}
