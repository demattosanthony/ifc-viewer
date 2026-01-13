import type { ViewerType } from "./types"

export type { FileContent, ViewerType } from "./types"

// Text/code file extensions that should use the Monaco editor
const textExtensions = new Set([
  // JavaScript/TypeScript
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "mts",
  "cts",
  // Web
  "css",
  "scss",
  "sass",
  "less",
  "svg",
  // Data formats
  "json",
  "jsonc",
  "json5",
  "xml",
  "yaml",
  "yml",
  "toml",
  "csv",
  // Config files
  "env",
  "gitignore",
  "gitattributes",
  "editorconfig",
  "prettierrc",
  "eslintrc",
  "npmrc",
  "nvmrc",
  // Documentation
  "md",
  "mdx",
  "txt",
  "rst",
  "asciidoc",
  // Programming languages
  "py",
  "pyw",
  "pyi",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "kts",
  "scala",
  "c",
  "h",
  "cpp",
  "hpp",
  "cc",
  "cxx",
  "cs",
  "fs",
  "fsx",
  "swift",
  "m",
  "mm",
  "php",
  "pl",
  "pm",
  "lua",
  "r",
  "jl",
  "ex",
  "exs",
  "erl",
  "hrl",
  "clj",
  "cljs",
  "cljc",
  "hs",
  "lhs",
  "elm",
  "dart",
  "v",
  "sv",
  "vhd",
  "vhdl",
  "zig",
  "nim",
  "cr",
  "d",
  // Shell/scripting
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "psm1",
  "bat",
  "cmd",
  // Query languages
  "sql",
  "graphql",
  "gql",
  // Build/config
  "makefile",
  "cmake",
  "dockerfile",
  "containerfile",
  "vagrantfile",
  "rakefile",
  "gemfile",
  "podfile",
  // Misc
  "log",
  "ini",
  "cfg",
  "conf",
  "properties",
  "lock",
])

// Special file extensions with dedicated viewers
const specialExtensions = new Map<string, ViewerType>([
  ["ifc", "ifc"],
  ["html", "html"],
  ["htm", "html"],
  ["pdf", "pdf"],
])

export function getViewerType(filename: string): ViewerType {
  const ext = filename.split(".").pop()?.toLowerCase() || ""

  // Check for special viewers first
  const specialViewer = specialExtensions.get(ext)
  if (specialViewer) {
    return specialViewer
  }

  // Check if it's a known text file
  if (textExtensions.has(ext)) {
    return "code"
  }

  // Handle files without extensions (often config/text files)
  const basename = filename.split("/").pop()?.toLowerCase() || ""
  const noExtensionTextFiles = new Set([
    "makefile",
    "dockerfile",
    "containerfile",
    "vagrantfile",
    "rakefile",
    "gemfile",
    "podfile",
    "readme",
    "license",
    "changelog",
    "authors",
    "contributors",
    "copying",
    "notice",
    "todo",
    "codeowners",
  ])

  if (noExtensionTextFiles.has(basename)) {
    return "code"
  }

  // Unknown file type - show unsupported viewer
  return "unsupported"
}
