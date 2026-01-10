/**
 * Memory Stream Store
 *
 * In-memory implementation of StreamStore using EventEmitter.
 * Designed for easy migration to Redis.
 */

import { EventEmitter } from "node:events"
import type { Stream, StreamEvent, StreamStore } from "@ifc-viewer/core"
import { createLogger } from "@ifc-viewer/logger"

const log = createLogger("streams:memory")

// ============================================================================
// Types
// ============================================================================

interface StreamState {
  stream: Stream
  events: StreamEvent[]
  emitter: EventEmitter
  cleanupTimer: Timer | null
}

export interface MemoryStreamStoreConfig {
  /** Time to keep completed streams before cleanup (default: 30 minutes) */
  ttlMs?: number
}

// ============================================================================
// Implementation
// ============================================================================

const DEFAULT_TTL_MS = 30 * 60 * 1000

export function createMemoryStreamStore(config?: MemoryStreamStoreConfig): StreamStore {
  const ttlMs = config?.ttlMs ?? DEFAULT_TTL_MS
  const streams = new Map<string, StreamState>()
  const activeByKey = new Map<string, string>() // key → streamId

  function scheduleCleanup(streamId: string): Timer {
    return setTimeout(() => {
      const state = streams.get(streamId)
      if (state) {
        log.debug("Cleaning up expired stream", { streamId })
        state.emitter.removeAllListeners()
        streams.delete(streamId)
      }
    }, ttlMs)
  }

  function finalize(
    streamId: string,
    status: "completed" | "error" | "aborted",
    error?: string
  ): void {
    const state = streams.get(streamId)
    if (!state) return

    state.stream.status = status
    state.stream.completedAt = new Date()
    if (error) state.stream.error = error

    // Clear active lookup if this stream owns the key
    if (state.stream.key && activeByKey.get(state.stream.key) === streamId) {
      activeByKey.delete(state.stream.key)
    }

    // Emit close for subscribers
    state.emitter.emit("close", status)

    // Schedule cleanup
    if (state.cleanupTimer) clearTimeout(state.cleanupTimer)
    state.cleanupTimer = scheduleCleanup(streamId)

    log.debug("Stream finalized", { streamId, status })
  }

  return {
    async create(id: string, key?: string): Promise<Stream> {
      // If key provided, abort any existing active stream for that key
      if (key) {
        const existingId = activeByKey.get(key)
        if (existingId) {
          log.debug("Aborting existing stream for key", { key, existingId })
          finalize(existingId, "aborted")
        }
      }

      const stream: Stream = {
        id,
        key: key ?? null,
        status: "active",
        lastSequence: -1,
        error: null,
        startedAt: new Date(),
        completedAt: null,
      }

      const state: StreamState = {
        stream,
        events: [],
        emitter: new EventEmitter(),
        cleanupTimer: null,
      }

      streams.set(id, state)
      if (key) activeByKey.set(key, id)

      log.debug("Stream created", { streamId: id, key })
      return { ...stream }
    },

    async get(id: string): Promise<Stream | null> {
      const state = streams.get(id)
      return state ? { ...state.stream } : null
    },

    async getActiveByKey(key: string): Promise<Stream | null> {
      const streamId = activeByKey.get(key)
      if (!streamId) return null

      const state = streams.get(streamId)
      if (!state || state.stream.status !== "active") {
        activeByKey.delete(key)
        return null
      }

      return { ...state.stream }
    },

    async complete(id: string): Promise<void> {
      finalize(id, "completed")
    },

    async abort(id: string): Promise<void> {
      finalize(id, "aborted")
    },

    async fail(id: string, error: string): Promise<void> {
      finalize(id, "error", error)
    },

    async append(id: string, event: unknown): Promise<number> {
      const state = streams.get(id)
      if (!state) {
        log.debug("Append to non-existent stream ignored", { streamId: id })
        return -1
      }
      if (state.stream.status !== "active") {
        // Stream was finalized (aborted/completed/error) - silently ignore
        // This handles race conditions during abort
        log.debug("Append to finalized stream ignored", {
          streamId: id,
          status: state.stream.status,
        })
        return -1
      }

      const sequence = state.events.length
      const streamEvent: StreamEvent = {
        sequence,
        event,
        timestamp: new Date(),
      }

      state.events.push(streamEvent)
      state.stream.lastSequence = sequence
      state.emitter.emit("event", streamEvent)

      return sequence
    },

    async *subscribe(id: string, after = -1): AsyncGenerator<StreamEvent> {
      const state = streams.get(id)
      if (!state) throw new Error(`Stream not found: ${id}`)

      // Yield past events
      for (const event of state.events) {
        if (event.sequence > after) yield event
      }

      // If not active, we're done
      if (state.stream.status !== "active") return

      // Subscribe to live events
      const queue: StreamEvent[] = []
      let resolve: (() => void) | null = null
      let closed = false

      const onEvent = (event: StreamEvent) => {
        queue.push(event)
        resolve?.()
        resolve = null
      }

      const onClose = () => {
        closed = true
        resolve?.()
        resolve = null
      }

      state.emitter.on("event", onEvent)
      state.emitter.on("close", onClose)

      try {
        while (!closed) {
          while (queue.length > 0) {
            const event = queue.shift()!
            if (event.sequence > after) yield event
          }
          if (!closed && queue.length === 0) {
            await new Promise<void>((r) => {
              resolve = r
            })
          }
        }
      } finally {
        state.emitter.off("event", onEvent)
        state.emitter.off("close", onClose)
      }
    },

    async dispose(): Promise<void> {
      log.info("Disposing stream store", { streamCount: streams.size })
      for (const [, state] of streams) {
        if (state.cleanupTimer) clearTimeout(state.cleanupTimer)
        state.emitter.emit("close", "disposed")
        state.emitter.removeAllListeners()
      }
      streams.clear()
      activeByKey.clear()
    },
  }
}
