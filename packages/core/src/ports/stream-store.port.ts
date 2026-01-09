/**
 * Stream Store Port
 *
 * Generic interface for durable event stream storage.
 * Supports replay and live subscription.
 */

// ============================================================================
// Types
// ============================================================================

export type StreamStatus = "active" | "completed" | "error" | "aborted"

export interface Stream {
  id: string
  key: string | null // e.g., conversationId for lookup
  status: StreamStatus
  lastSequence: number
  error: string | null
  startedAt: Date
  completedAt: Date | null
}

export interface StreamEvent {
  sequence: number
  event: unknown
  timestamp: Date
}

// ============================================================================
// Port Interface
// ============================================================================

export interface StreamStore {
  /**
   * Create a new stream.
   * @param id - Unique stream identifier
   * @param key - Optional lookup key (e.g., conversationId). Only one active stream per key.
   */
  create(id: string, key?: string): Promise<Stream>

  /**
   * Get stream by ID.
   */
  get(id: string): Promise<Stream | null>

  /**
   * Get the active stream for a key, if any.
   */
  getActiveByKey(key: string): Promise<Stream | null>

  /**
   * Mark stream as completed successfully.
   */
  complete(id: string): Promise<void>

  /**
   * Mark stream as aborted (cancelled).
   */
  abort(id: string): Promise<void>

  /**
   * Mark stream as failed with an error.
   */
  fail(id: string, error: string): Promise<void>

  /**
   * Append an event to the stream.
   * Returns the sequence number assigned.
   */
  append(id: string, event: unknown): Promise<number>

  /**
   * Subscribe to stream events.
   * Yields past events (after `after`), then continues with live events if active.
   *
   * @param id - Stream ID
   * @param after - Start after this sequence (exclusive). Omit or -1 for all events.
   */
  subscribe(id: string, after?: number): AsyncGenerator<StreamEvent>

  /**
   * Clean up resources.
   */
  dispose(): Promise<void>
}
