// Primary API
export { closeLogs, createLogger, flushLogs } from "./logger.ts"
// Transports (for custom logger setups)
export { ConsoleTransport } from "./transports/console.ts"
export { FileTransport } from "./transports/file.ts"
// Types
export type { LogEntry, Logger, LoggerConfig, LogLevel, Transport } from "./types.ts"
export { LOG_LEVEL_PRIORITY, LOG_LEVELS } from "./types.ts"
