import type { LogEntry, LogLevel, Transport } from "../types.ts"

// ANSI color codes
const RESET = "\x1b[0m"
const DIM = "\x1b[2m"
const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m",  // green
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
}

/**
 * Format timestamp as HH:MM:SS
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

/**
 * Format data object as key=value pairs with dim styling
 */
function formatData(data: Record<string, unknown> | undefined): string {
  if (!data || Object.keys(data).length === 0) return ""

  const pairs = Object.entries(data).map(([key, value]) => {
    if (value instanceof Error) return `${key}=${value.message}`
    if (typeof value === "string") return `${key}="${value}"`
    return `${key}=${JSON.stringify(value)}`
  })

  return ` ${DIM}${pairs.join(" ")}${RESET}`
}

/**
 * Console transport with colored output.
 * 
 * Output format: HH:MM:SS LEVEL [namespace] message key=value...
 */
export class ConsoleTransport implements Transport {
  write(entry: LogEntry): void {
    const time = `${DIM}${formatTime(entry.timestamp)}${RESET}`
    const level = `${COLORS[entry.level]}${LEVEL_LABELS[entry.level]}${RESET}`
    const namespace = `${DIM}[${entry.namespace}]${RESET}`
    const data = formatData(entry.data)
    const line = `${time} ${level} ${namespace} ${entry.message}${data}`

    if (entry.level === "error") {
      console.error(line)
    } else if (entry.level === "warn") {
      console.warn(line)
    } else {
      console.log(line)
    }
  }
}
