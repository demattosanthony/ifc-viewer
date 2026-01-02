import type { FileSystem, FileEntry, FileStat, FileContent, FileReadOptions } from "@ifc-viewer/core"
import type { Container } from "dockerode"
import { resolve, normalize } from "node:path"

/**
 * Docker-based FileSystem implementation
 *
 * Uses `docker exec` to perform file operations inside the container.
 * All paths are relative to the baseDir (typically /workspace).
 */
export class DockerFileSystem implements FileSystem {
  constructor(
    private container: Container,
    private baseDir: string
  ) {}

  /**
   * Resolve path within the container's sandbox
   * Uses the same security pattern as LocalFileSystem
   */
  private resolvePath(path: string): string {
    // Normalize and resolve the path relative to baseDir
    const resolved = resolve(
      this.baseDir,
      path.startsWith("/") ? path.slice(1) : path
    )

    // Security: ensure resolved path is still within baseDir
    // This catches any .. traversal attempts
    if (!resolved.startsWith(this.baseDir)) {
      throw new Error(`Path escapes sandbox: ${path}`)
    }

    return resolved
  }

  /**
   * Execute a command inside the container and return stdout
   */
  private async exec(cmd: string[], options: { encoding?: "binary" } = {}): Promise<string | Buffer> {
    const exec = await this.container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false, // Important: no TTY for non-interactive commands
    })

    // Use demuxStream for proper stdout/stderr separation
    const stream = await exec.start({ Tty: false })

    return new Promise((resolvePromise, reject) => {
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []

      // Demux the stream into stdout and stderr
      const { PassThrough } = require("stream")
      const stdout = new PassThrough()
      const stderr = new PassThrough()

      this.container.modem.demuxStream(stream, stdout, stderr)

      stdout.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk)
      })

      stderr.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk)
      })

      stream.on("end", async () => {
        const stdoutData = Buffer.concat(stdoutChunks as unknown as Uint8Array[])
        const stderrData = Buffer.concat(stderrChunks as unknown as Uint8Array[])

        // Check exit code
        const inspection = await exec.inspect()
        if (inspection.ExitCode !== 0) {
          reject(new Error(stderrData.toString() || `Command failed with exit code ${inspection.ExitCode}`))
          return
        }

        if (options.encoding === "binary") {
          resolvePromise(stdoutData)
        } else {
          resolvePromise(stdoutData.toString())
        }
      })

      stream.on("error", reject)
    })
  }

  /**
   * Create a minimal tar archive containing a single file
   * Uses USTAR format compatible with Docker's putArchive
   */
  private createTarArchive(filename: string, content: Buffer): Buffer {
    const headerSize = 512

    // Extract just the filename (no path)
    const basename = filename.split("/").pop() || filename

    const header = Buffer.alloc(headerSize)

    // File name (100 bytes)
    header.write(basename, 0, Math.min(basename.length, 100))
    // File mode (8 bytes) - 0644
    header.write("0000644\0", 100, 8)
    // Owner UID (8 bytes)
    header.write("0000000\0", 108, 8)
    // Group GID (8 bytes)
    header.write("0000000\0", 116, 8)
    // File size in octal (12 bytes)
    header.write(content.length.toString(8).padStart(11, "0") + " ", 124, 12)
    // Modification time (12 bytes)
    header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, "0") + " ", 136, 12)
    // Checksum placeholder (8 bytes) - spaces for calculation
    header.fill(" ", 148, 156)
    // Type flag - '0' for regular file
    header.write("0", 156, 1)
    // Link name (100 bytes) - empty
    // Magic 'ustar' (6 bytes)
    header.write("ustar\0", 257, 6)
    // Version (2 bytes)
    header.write("00", 263, 2)
    // Owner name (32 bytes)
    header.write("root", 265, 32)
    // Group name (32 bytes)
    header.write("root", 297, 32)

    // Calculate checksum (sum of all bytes in header, treating checksum field as spaces)
    let checksum = 0
    for (let i = 0; i < headerSize; i++) {
      checksum += header[i]!
    }
    // Write checksum as 6-digit octal + null + space
    header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8)

    // Pad content to 512-byte boundary
    const paddedSize = Math.ceil(content.length / 512) * 512
    const paddedContent = Buffer.alloc(paddedSize)
    content.copy(paddedContent as unknown as Uint8Array)

    // End of archive (two 512-byte zero blocks)
    const endBlocks = Buffer.alloc(1024)

    return Buffer.concat([header, paddedContent, endBlocks] as unknown as Uint8Array[])
  }

  async read(path: string, options?: FileReadOptions): Promise<FileContent> {
    const fullPath = this.resolvePath(path)

    if (options?.encoding === "binary") {
      const data = (await this.exec(["cat", fullPath], { encoding: "binary" })) as Buffer
      return {
        type: "binary",
        content: new Uint8Array(data),
      }
    }

    const content = (await this.exec(["cat", fullPath])) as string
    return {
      type: "text",
      content,
    }
  }

  async write(path: string, content: string | Uint8Array): Promise<void> {
    const fullPath = this.resolvePath(path)

    // Ensure parent directory exists
    const parentDir = fullPath.substring(0, fullPath.lastIndexOf("/"))
    if (parentDir && parentDir !== this.baseDir) {
      await this.exec(["mkdir", "-p", parentDir]).catch(() => {})
    }

    // Convert content to Buffer
    const data = typeof content === "string" ? Buffer.from(content) : Buffer.from(content)

    // Extract filename from path
    const filename = fullPath.split("/").pop() || "file"

    // Create tar archive and use Docker's putArchive API
    // This handles arbitrarily large files without command line limits
    const tarBuffer = this.createTarArchive(filename, data)
    await this.container.putArchive(tarBuffer, { path: parentDir || this.baseDir })
  }

  async list(path: string): Promise<FileEntry[]> {
    const fullPath = this.resolvePath(path)

    // Use stat with specific format to get all needed info
    // Format: type|name|size|mtime
    const output = (await this.exec([
      "bash",
      "-c",
      `cd '${fullPath}' && for f in * .[!.]* ..?*; do
        [ -e "$f" ] || continue
        if [ -L "$f" ]; then
          type="symlink"
        elif [ -d "$f" ]; then
          type="directory"
        else
          type="file"
        fi
        size=$(stat -c %s "$f" 2>/dev/null || echo 0)
        mtime=$(stat -c %Y "$f" 2>/dev/null || echo 0)
        echo "$type|$f|$size|$mtime"
      done`,
    ])) as string

    const entries: FileEntry[] = []

    for (const line of output.trim().split("\n")) {
      if (!line) continue

      const [type, name, sizeStr, mtimeStr] = line.split("|")
      if (!type || !name) continue

      // Compute relative path from baseDir
      const entryPath =
        fullPath === this.baseDir ? `/${name}` : `/${fullPath.slice(this.baseDir.length + 1)}/${name}`

      entries.push({
        name,
        path: entryPath.replace(/\/+/g, "/"),
        type: type as "file" | "directory" | "symlink",
        size: parseInt(sizeStr || "0", 10),
        modifiedAt: parseInt(mtimeStr || "0", 10) * 1000, // Convert to ms
      })
    }

    return entries
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const fullPath = this.resolvePath(path)
    const flags = options?.recursive ? "-p" : ""
    await this.exec(["mkdir", flags, fullPath].filter(Boolean))
  }

  async delete(path: string, options?: { recursive?: boolean }): Promise<void> {
    const fullPath = this.resolvePath(path)

    // Check if it's a directory
    const typeOutput = (await this.exec([
      "bash",
      "-c",
      `if [ -d '${fullPath}' ]; then echo dir; else echo file; fi`,
    ])) as string

    const isDir = typeOutput.trim() === "dir"

    if (isDir) {
      if (options?.recursive) {
        await this.exec(["rm", "-rf", fullPath])
      } else {
        await this.exec(["rmdir", fullPath])
      }
    } else {
      await this.exec(["rm", "-f", fullPath])
    }
  }

  async stat(path: string): Promise<FileStat> {
    const fullPath = this.resolvePath(path)

    // Get file stats using stat command
    const output = (await this.exec([
      "stat",
      "-c",
      "%F|%s|%W|%Y|%X",
      fullPath,
    ])) as string

    const [typeStr, sizeStr, ctimeStr, mtimeStr, atimeStr] = output.trim().split("|")

    let type: FileStat["type"] = "file"
    if (typeStr?.includes("directory")) {
      type = "directory"
    } else if (typeStr?.includes("link")) {
      type = "symlink"
    }

    return {
      type,
      size: parseInt(sizeStr || "0", 10),
      createdAt: parseInt(ctimeStr || "0", 10) * 1000,
      modifiedAt: parseInt(mtimeStr || "0", 10) * 1000,
      accessedAt: parseInt(atimeStr || "0", 10) * 1000,
    }
  }

  async copy(src: string, dest: string): Promise<void> {
    const srcPath = this.resolvePath(src)
    const destPath = this.resolvePath(dest)

    // Ensure parent directory exists
    const parentDir = destPath.substring(0, destPath.lastIndexOf("/"))
    if (parentDir && parentDir !== this.baseDir) {
      await this.exec(["mkdir", "-p", parentDir]).catch(() => {})
    }

    // Use cp -r to handle both files and directories
    await this.exec(["cp", "-r", srcPath, destPath])
  }

  async move(src: string, dest: string): Promise<void> {
    const srcPath = this.resolvePath(src)
    const destPath = this.resolvePath(dest)

    // Ensure parent directory exists
    const parentDir = destPath.substring(0, destPath.lastIndexOf("/"))
    if (parentDir && parentDir !== this.baseDir) {
      await this.exec(["mkdir", "-p", parentDir]).catch(() => {})
    }

    await this.exec(["mv", srcPath, destPath])
  }
}
