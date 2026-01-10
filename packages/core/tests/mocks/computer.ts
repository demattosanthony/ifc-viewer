/**
 * Mock Computer Implementation
 *
 * A simple in-memory mock of the Computer interface for testing.
 */

import type {
  Computer,
  FileSystem,
  FileEntry,
  FileContent,
  FileStat,
  Shell,
  TerminalSession,
} from "../../src/ports"

interface MockFile {
  content: Uint8Array
  modifiedAt: number
}

/**
 * Create a mock FileSystem that stores files in memory.
 * Exposes internal _files map for test manipulation.
 */
export function createMockFileSystem(): FileSystem & {
  _files: Map<string, MockFile>
} {
  const files = new Map<string, MockFile>()

  const normalize = (path: string): string =>
    path.replace(/^\.\//, "").replace(/^\//, "")

  return {
    _files: files,

    async read(path: string): Promise<FileContent> {
      const file = files.get(normalize(path))
      if (!file) throw new Error(`File not found: ${path}`)
      return {
        type: "text",
        content: new TextDecoder().decode(file.content),
      }
    },

    async write(path: string, content: string | Uint8Array): Promise<void> {
      const data =
        typeof content === "string"
          ? new TextEncoder().encode(content)
          : content
      files.set(normalize(path), { content: data, modifiedAt: Date.now() })
    },

    async list(path: string): Promise<FileEntry[]> {
      const normalized = normalize(path).replace(/\/$/, "")
      const prefix = normalized === "." || normalized === "" ? "" : `${normalized}/`
      const entries: FileEntry[] = []
      const seenDirs = new Set<string>()

      for (const [filePath, file] of files) {
        if (prefix && !filePath.startsWith(prefix)) continue

        const relativePath = prefix ? filePath.slice(prefix.length) : filePath

        if (!prefix && filePath.includes("/")) {
          const dirName = filePath.split("/")[0]!
          if (!seenDirs.has(dirName)) {
            seenDirs.add(dirName)
            entries.push({
              name: dirName,
              path: dirName,
              type: "directory",
              size: 0,
              modifiedAt: Date.now(),
            })
          }
          continue
        }

        if (relativePath.includes("/")) {
          const dirName = relativePath.split("/")[0]!
          const dirPath = prefix ? `${prefix}${dirName}` : dirName
          if (!seenDirs.has(dirPath)) {
            seenDirs.add(dirPath)
            entries.push({
              name: dirName,
              path: dirPath,
              type: "directory",
              size: 0,
              modifiedAt: Date.now(),
            })
          }
        } else {
          entries.push({
            name: relativePath,
            path: filePath,
            type: "file",
            size: file.content.length,
            modifiedAt: file.modifiedAt,
          })
        }
      }

      return entries
    },

    async mkdir(): Promise<void> {},

    async delete(path: string): Promise<void> {
      files.delete(normalize(path))
    },

    async stat(path: string): Promise<FileStat> {
      const file = files.get(normalize(path))
      if (!file) throw new Error(`File not found: ${path}`)
      return {
        type: "file",
        size: file.content.length,
        createdAt: file.modifiedAt,
        modifiedAt: file.modifiedAt,
        accessedAt: file.modifiedAt,
      }
    },

    async copy(): Promise<void> {},

    async move(src: string, dest: string): Promise<void> {
      const file = files.get(normalize(src))
      if (file) {
        files.set(normalize(dest), file)
        files.delete(normalize(src))
      }
    },
  }
}

/**
 * Create a mock Computer using the provided FileSystem.
 */
export function createMockComputer(fs: FileSystem): Computer {
  const mockTerminal = {} as TerminalSession
  const mockPythonSession = {} as TerminalSession
  const mockShell: Shell = {
    startTerminal: async () => mockTerminal,
    startPythonTerminal: async () => mockPythonSession,
  }

  return {
    id: "mock-computer",
    workingDirectory: "/workspace",
    files: fs,
    shell: mockShell,
    createTerminal: async () => mockTerminal,
    getTerminal: () => undefined,
    getAllTerminals: () => [],
    disposeTerminal: async () => {},
    getOrCreateAgentTerminal: async () => mockTerminal,
    hasAgentTerminal: () => false,
    getOrCreateAgentPythonSession: async () => mockPythonSession,
    hasAgentPythonSession: () => false,
    dispose: async () => {},
  }
}
