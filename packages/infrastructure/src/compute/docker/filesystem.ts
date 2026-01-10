import { resolve } from "node:path"
import type {
  FileContent,
  FileEntry,
  FileReadOptions,
  FileStat,
  FileSystem,
} from "@ifc-viewer/core"
import type { Container } from "dockerode"

export class DockerFileSystem implements FileSystem {
  constructor(
    private container: Container,
    private baseDir: string
  ) {}

  private resolvePath(path: string): string {
    const resolved = resolve(this.baseDir, path.startsWith("/") ? path.slice(1) : path)

    if (!resolved.startsWith(this.baseDir)) {
      throw new Error(`Path escapes sandbox: ${path}`)
    }

    return resolved
  }

  private async exec(
    cmd: string[],
    options: { encoding?: "binary" } = {}
  ): Promise<string | Buffer> {
    const exec = await this.container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    })

    const stream = await exec.start({ Tty: false })

    return new Promise((resolvePromise, reject) => {
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []

      const { PassThrough } = require("node:stream")
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

        const inspection = await exec.inspect()
        if (inspection.ExitCode !== 0) {
          reject(
            new Error(
              stderrData.toString() || `Command failed with exit code ${inspection.ExitCode}`
            )
          )
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

  private createTarArchive(filename: string, content: Buffer): Buffer {
    const headerSize = 512

    // Extract just the filename (no path)
    const basename = filename.split("/").pop() || filename

    const header = Buffer.alloc(headerSize)

    header.write(basename, 0, Math.min(basename.length, 100))
    header.write("0000644\0", 100, 8)
    header.write("0000000\0", 108, 8)
    header.write("0000000\0", 116, 8)
    header.write(`${content.length.toString(8).padStart(11, "0")} `, 124, 12)
    header.write(
      `${Math.floor(Date.now() / 1000)
        .toString(8)
        .padStart(11, "0")} `,
      136,
      12
    )
    header.fill(" ", 148, 156)
    header.write("0", 156, 1)
    header.write("ustar\0", 257, 6)
    header.write("00", 263, 2)
    header.write("root", 265, 32)
    header.write("root", 297, 32)

    let checksum = 0
    for (let i = 0; i < headerSize; i++) {
      checksum += header[i]!
    }
    header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8)

    const paddedSize = Math.ceil(content.length / 512) * 512
    const paddedContent = Buffer.alloc(paddedSize)
    content.copy(paddedContent as unknown as Uint8Array)

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

    const parentDir = fullPath.substring(0, fullPath.lastIndexOf("/"))
    if (parentDir && parentDir !== this.baseDir) {
      await this.exec(["mkdir", "-p", parentDir]).catch(() => {})
    }

    const data = typeof content === "string" ? Buffer.from(content) : Buffer.from(content)
    const filename = fullPath.split("/").pop() || "file"
    const tarBuffer = this.createTarArchive(filename, data)
    await this.container.putArchive(tarBuffer, { path: parentDir || this.baseDir })
  }

  async list(path: string): Promise<FileEntry[]> {
    const fullPath = this.resolvePath(path)

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

      const entryPath =
        fullPath === this.baseDir
          ? `/${name}`
          : `/${fullPath.slice(this.baseDir.length + 1)}/${name}`

      entries.push({
        name,
        path: entryPath.replace(/\/+/g, "/"),
        type: type as "file" | "directory" | "symlink",
        size: parseInt(sizeStr || "0", 10),
        modifiedAt: parseInt(mtimeStr || "0", 10) * 1000,
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

    const checkOutput = (await this.exec([
      "bash",
      "-c",
      `if [ ! -e '${fullPath}' ]; then echo none; elif [ -d '${fullPath}' ]; then echo dir; else echo file; fi`,
    ])) as string

    const pathType = checkOutput.trim()

    if (pathType === "none") {
      return
    }

    if (pathType === "dir") {
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

    const output = (await this.exec(["stat", "-c", "%F|%s|%W|%Y|%X", fullPath])) as string

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

    const parentDir = destPath.substring(0, destPath.lastIndexOf("/"))
    if (parentDir && parentDir !== this.baseDir) {
      await this.exec(["mkdir", "-p", parentDir]).catch(() => {})
    }

    await this.exec(["cp", "-r", srcPath, destPath])
  }

  async move(src: string, dest: string): Promise<void> {
    const srcPath = this.resolvePath(src)
    const destPath = this.resolvePath(dest)

    const parentDir = destPath.substring(0, destPath.lastIndexOf("/"))
    if (parentDir && parentDir !== this.baseDir) {
      await this.exec(["mkdir", "-p", parentDir]).catch(() => {})
    }

    await this.exec(["mv", srcPath, destPath])
  }
}
