import { appendFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join } from "node:path"
import type { LogEntry, Transport } from "../types.ts"

/** Buffer flush interval in milliseconds */
const FLUSH_INTERVAL_MS = 1000

/** Maximum buffer size before forcing a flush */
const BUFFER_THRESHOLD = 100

/**
 * Format a log entry as a plain text line.
 * Format: TIMESTAMP LEVEL [namespace] message key=value...
 */
function formatEntry(entry: LogEntry): string {
  const timestamp = entry.timestamp.toISOString()
  const level = entry.level.toUpperCase().padEnd(5)
  const data = formatData(entry.data)
  return `${timestamp} ${level} [${entry.namespace}] ${entry.message}${data}\n`
}

/**
 * Format data object as key=value pairs
 */
function formatData(data: Record<string, unknown> | undefined): string {
  if (!data || Object.keys(data).length === 0) return ""

  const pairs = Object.entries(data).map(([key, value]) => {
    if (value instanceof Error) return `${key}="${value.message}"`
    if (typeof value === "string") return `${key}="${value}"`
    return `${key}=${JSON.stringify(value)}`
  })

  return ` ${pairs.join(" ")}`
}

/**
 * Get today's date as YYYY-MM-DD for log file naming
 */
function getDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * File transport with daily rotation and async buffered writes.
 * 
 * Logs are buffered in memory and flushed periodically or when the buffer
 * reaches a threshold. Files are named app.YYYY-MM-DD.log and rotate daily.
 */
export class FileTransport implements Transport {
  private readonly logDir: string
  private buffer: string[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private isWriting = false
  private dirExists = false

  constructor(logDir: string) {
    this.logDir = logDir
    this.startFlushTimer()
  }

  write(entry: LogEntry): void {
    this.buffer.push(formatEntry(entry))

    if (this.buffer.length >= BUFFER_THRESHOLD) {
      void this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.isWriting) return

    this.isWriting = true
    const lines = this.buffer.splice(0)

    try {
      await this.ensureDir()
      const filePath = join(this.logDir, `app.${getDateString()}.log`)
      await appendFile(filePath, lines.join(""))
    } catch (error) {
      // Restore buffer on failure
      this.buffer.unshift(...lines)
      console.error("[logger] Failed to write to log file:", error)
    } finally {
      this.isWriting = false
    }
  }

  async close(): Promise<void> {
    this.stopFlushTimer()
    await this.flush()
  }

  private startFlushTimer(): void {
    this.flushTimer = setTimeout(() => {
      void this.flush().finally(() => this.startFlushTimer())
    }, FLUSH_INTERVAL_MS)
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }

  private async ensureDir(): Promise<void> {
    if (this.dirExists) return
    if (!existsSync(this.logDir)) {
      await mkdir(this.logDir, { recursive: true })
    }
    this.dirExists = true
  }
}
