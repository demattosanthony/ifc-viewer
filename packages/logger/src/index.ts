// Primary API
export { createLogger, flushLogs, closeLogs } from "./logger.ts"

// Types
export type { Logger, LogLevel, LogEntry, LoggerConfig, Transport } from "./types.ts"
export { LOG_LEVELS, LOG_LEVEL_PRIORITY } from "./types.ts"

// Transports (for custom logger setups)
export { ConsoleTransport } from "./transports/console.ts"
export { FileTransport } from "./transports/file.ts"
