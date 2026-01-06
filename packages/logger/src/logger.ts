import { getConfig } from "./config.ts"
import { ConsoleTransport, FileTransport } from "./transports/index.ts"
import type { LogEntry, Logger, LogLevel, Transport } from "./types.ts"
import { LOG_LEVEL_PRIORITY } from "./types.ts"

// ============================================================================
// Singleton State
// ============================================================================

/** Shared transports used by all logger instances */
let transports: Transport[] | null = null

/**
 * Initialize transports lazily on first logger creation.
 * All loggers share the same transport instances.
 */
function getTransports(): Transport[] {
  if (transports) return transports

  const config = getConfig()
  transports = []

  if (config.logToConsole) {
    transports.push(new ConsoleTransport())
  }
  if (config.logToFile) {
    transports.push(new FileTransport(config.logDir))
  }

  return transports
}

// ============================================================================
// Logger Implementation
// ============================================================================

class LoggerImpl implements Logger {
  constructor(
    private readonly namespace: string,
    private readonly minLevel: LogLevel
  ) {}

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data)
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data)
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log("error", message, data)
  }

  child(name: string): Logger {
    return new LoggerImpl(`${this.namespace}:${name}`, this.minLevel)
  }

  async flush(): Promise<void> {
    await Promise.all(getTransports().map((t) => t.flush?.()))
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      namespace: this.namespace,
      message,
      data,
    }

    for (const transport of getTransports()) {
      transport.write(entry)
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Create a logger with the given namespace.
 *
 * @example
 * ```ts
 * const log = createLogger("server")
 * log.info("Server started", { port: 3000 })
 *
 * const dbLog = log.child("database")
 * dbLog.debug("Query executed", { duration: 42 })
 * ```
 */
export function createLogger(namespace: string): Logger {
  const config = getConfig()
  return new LoggerImpl(namespace, config.level)
}

/**
 * Flush all pending log writes.
 * Call before process exit to ensure all logs are written.
 */
export async function flushLogs(): Promise<void> {
  if (transports) {
    await Promise.all(transports.map((t) => t.flush?.()))
  }
}

/**
 * Close all transports and flush pending writes.
 * Call on graceful shutdown.
 */
export async function closeLogs(): Promise<void> {
  if (transports) {
    await Promise.all(transports.map((t) => t.close?.()))
    transports = null
  }
}
