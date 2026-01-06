/**
 * Log levels in order of severity (lowest to highest)
 */
export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

/**
 * Numeric priority for log levels (higher = more severe)
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: Date
  level: LogLevel
  namespace: string
  message: string
  data?: Record<string, unknown>
}

/**
 * Transport interface for log output destinations
 */
export interface Transport {
  write(entry: LogEntry): void
  flush?(): Promise<void>
  close?(): Promise<void>
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel
  /** Directory for log files */
  logDir: string
  /** Enable file logging */
  logToFile: boolean
  /** Enable console logging */
  logToConsole: boolean
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, data?: Record<string, unknown>): void
  child(namespace: string): Logger
  flush(): Promise<void>
}
