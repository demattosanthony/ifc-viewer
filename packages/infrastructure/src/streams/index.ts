/**
 * Stream Store Implementations
 *
 * Currently provides in-memory storage with EventEmitter.
 * Designed for future Redis implementation.
 */

export {
  createMemoryStreamStore,
  type MemoryStreamStoreConfig,
} from "./memory-stream-store"
