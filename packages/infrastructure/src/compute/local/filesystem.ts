import { copyFile, lstat, mkdir, readdir, rename, rm, rmdir, stat, unlink } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"
import type {
  FileContent,
  FileEntry,
  FileReadOptions,
  FileStat,
  FileSystem,
} from "@ifc-viewer/core"

export class LocalFileSystem implements FileSystem {
  constructor(private baseDir: string) {}

  private resolvePath(path: string): string {
    const resolved = resolve(this.baseDir, path.startsWith("/") ? path.slice(1) : path)

    if (!resolved.startsWith(this.baseDir)) {
      throw new Error(`Path escapes sandbox: ${path}`)
    }

    return resolved
  }

  async read(path: string, options?: FileReadOptions): Promise<FileContent> {
    if (options?.encoding === "binary") {
      const fullPath = this.resolvePath(path)
      const file = Bun.file(fullPath)
      return {
        type: "binary",
        content: new Uint8Array(await file.arrayBuffer()),
      }
    }
    const fullPath = this.resolvePath(path)
    const file = Bun.file(fullPath)
    return {
      type: "text",
      content: await file.text(),
    }
  }

  async write(path: string, content: string | Uint8Array): Promise<void> {
    const fullPath = this.resolvePath(path)
    const parentDir = fullPath.substring(0, fullPath.lastIndexOf("/"))
    await mkdir(parentDir, { recursive: true }).catch(() => {})

    await Bun.write(fullPath, content)
  }

  async list(path: string): Promise<FileEntry[]> {
    const fullPath = this.resolvePath(path)
    const entries = await readdir(fullPath, { withFileTypes: true })

    const results: FileEntry[] = []

    for (const entry of entries) {
      const entryPath = join(fullPath, entry.name)
      const stats = await stat(entryPath).catch(() => null)

      if (stats) {
        results.push({
          name: entry.name,
          path: `/${relative(this.baseDir, entryPath)}`,
          type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file",
          size: stats.size,
          modifiedAt: stats.mtimeMs,
        })
      }
    }

    return results
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const fullPath = this.resolvePath(path)
    await mkdir(fullPath, { recursive: options?.recursive ?? false })
  }

  async delete(path: string, options?: { recursive?: boolean }): Promise<void> {
    const fullPath = this.resolvePath(path)

    try {
      const stats = await lstat(fullPath)

      if (stats.isDirectory()) {
        if (options?.recursive) {
          await rm(fullPath, { recursive: true, force: true })
        } else {
          await rmdir(fullPath)
        }
      } else {
        await unlink(fullPath)
      }
    } catch (error) {
      // Ignore ENOENT (file not found) - consistent with rm -f behavior
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return
      }
      throw error
    }
  }

  async stat(path: string): Promise<FileStat> {
    const fullPath = this.resolvePath(path)
    const stats = await lstat(fullPath)

    let type: FileStat["type"] = "file"
    if (stats.isDirectory()) {
      type = "directory"
    } else if (stats.isSymbolicLink()) {
      type = "symlink"
    }

    return {
      type,
      size: stats.size,
      createdAt: stats.birthtimeMs,
      modifiedAt: stats.mtimeMs,
      accessedAt: stats.atimeMs,
    }
  }

  async copy(src: string, dest: string): Promise<void> {
    const srcPath = this.resolvePath(src)
    const destPath = this.resolvePath(dest)
    await mkdir(dirname(destPath), { recursive: true }).catch(() => {})

    const srcStat = await lstat(srcPath)
    if (srcStat.isDirectory()) {
      await this.copyDir(srcPath, destPath)
    } else {
      await copyFile(srcPath, destPath)
    }
  }

  private async copyDir(src: string, dest: string): Promise<void> {
    await mkdir(dest, { recursive: true })
    const entries = await readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcEntry = join(src, entry.name)
      const destEntry = join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDir(srcEntry, destEntry)
      } else {
        await copyFile(srcEntry, destEntry)
      }
    }
  }

  async move(src: string, dest: string): Promise<void> {
    const srcPath = this.resolvePath(src)
    const destPath = this.resolvePath(dest)
    await mkdir(dirname(destPath), { recursive: true }).catch(() => {})

    await rename(srcPath, destPath)
  }
}
