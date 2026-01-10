/**
 * MemoryStreamStore Tests
 *
 * Tests for the in-memory stream store implementation.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { StreamStore } from "@ifc-viewer/core"
import { createMemoryStreamStore } from "../../src/streams/memory-stream-store.ts"

describe("MemoryStreamStore", () => {
  let store: StreamStore

  beforeEach(() => {
    store = createMemoryStreamStore({ ttlMs: 1000 }) // Short TTL for tests
  })

  afterEach(async () => {
    await store.dispose()
  })

  describe("create", () => {
    test("creates a stream with the given id", async () => {
      const stream = await store.create("stream-1")

      expect(stream.id).toBe("stream-1")
      expect(stream.status).toBe("active")
      expect(stream.key).toBeNull()
      expect(stream.lastSequence).toBe(-1)
      expect(stream.error).toBeNull()
      expect(stream.startedAt).toBeInstanceOf(Date)
      expect(stream.completedAt).toBeNull()
    })

    test("creates a stream with a key", async () => {
      const stream = await store.create("stream-1", "conversation-123")

      expect(stream.id).toBe("stream-1")
      expect(stream.key).toBe("conversation-123")
    })

    test("aborts existing active stream when creating new stream with same key", async () => {
      await store.create("stream-1", "conversation-123")
      await store.create("stream-2", "conversation-123")

      const oldStream = await store.get("stream-1")
      const newStream = await store.get("stream-2")

      expect(oldStream?.status).toBe("aborted")
      expect(newStream?.status).toBe("active")
    })
  })

  describe("get", () => {
    test("returns stream by id", async () => {
      await store.create("stream-1")

      const stream = await store.get("stream-1")

      expect(stream).not.toBeNull()
      expect(stream?.id).toBe("stream-1")
    })

    test("returns null for non-existent stream", async () => {
      const stream = await store.get("non-existent")

      expect(stream).toBeNull()
    })

    test("returns a copy of the stream", async () => {
      const _created = await store.create("stream-1")
      const retrieved = await store.get("stream-1")

      // Mutating the retrieved stream should not affect the stored one
      retrieved!.status = "completed"

      const fresh = await store.get("stream-1")
      expect(fresh?.status).toBe("active")
    })
  })

  describe("getActiveByKey", () => {
    test("returns active stream for key", async () => {
      await store.create("stream-1", "conversation-123")

      const stream = await store.getActiveByKey("conversation-123")

      expect(stream).not.toBeNull()
      expect(stream?.id).toBe("stream-1")
    })

    test("returns null when no active stream for key", async () => {
      const stream = await store.getActiveByKey("non-existent")

      expect(stream).toBeNull()
    })

    test("returns null after stream is completed", async () => {
      await store.create("stream-1", "conversation-123")
      await store.complete("stream-1")

      const stream = await store.getActiveByKey("conversation-123")

      expect(stream).toBeNull()
    })

    test("returns newest active stream after previous is aborted", async () => {
      await store.create("stream-1", "conversation-123")
      await store.create("stream-2", "conversation-123")

      const stream = await store.getActiveByKey("conversation-123")

      expect(stream?.id).toBe("stream-2")
    })
  })

  describe("complete", () => {
    test("marks stream as completed", async () => {
      await store.create("stream-1")
      await store.complete("stream-1")

      const stream = await store.get("stream-1")

      expect(stream?.status).toBe("completed")
      expect(stream?.completedAt).toBeInstanceOf(Date)
    })
  })

  describe("abort", () => {
    test("marks stream as aborted", async () => {
      await store.create("stream-1")
      await store.abort("stream-1")

      const stream = await store.get("stream-1")

      expect(stream?.status).toBe("aborted")
      expect(stream?.completedAt).toBeInstanceOf(Date)
    })
  })

  describe("fail", () => {
    test("marks stream as error with message", async () => {
      await store.create("stream-1")
      await store.fail("stream-1", "Something went wrong")

      const stream = await store.get("stream-1")

      expect(stream?.status).toBe("error")
      expect(stream?.error).toBe("Something went wrong")
      expect(stream?.completedAt).toBeInstanceOf(Date)
    })
  })

  describe("append", () => {
    test("appends events to stream", async () => {
      await store.create("stream-1")

      const seq1 = await store.append("stream-1", { type: "text", content: "Hello" })
      const seq2 = await store.append("stream-1", { type: "text", content: "World" })

      expect(seq1).toBe(0)
      expect(seq2).toBe(1)

      const stream = await store.get("stream-1")
      expect(stream?.lastSequence).toBe(1)
    })

    test("returns -1 when stream does not exist", async () => {
      const result = await store.append("non-existent", { type: "text" })
      expect(result).toBe(-1)
    })

    test("returns -1 when stream is not active (graceful handling for abort)", async () => {
      await store.create("stream-1")
      await store.complete("stream-1")

      const result = await store.append("stream-1", { type: "text" })
      expect(result).toBe(-1)
    })
  })

  describe("subscribe", () => {
    test("yields past events", async () => {
      await store.create("stream-1")
      await store.append("stream-1", { type: "a" })
      await store.append("stream-1", { type: "b" })
      await store.complete("stream-1")

      const events = []
      for await (const event of store.subscribe("stream-1")) {
        events.push(event)
      }

      expect(events.length).toBe(2)
      expect(events[0]?.sequence).toBe(0)
      expect(events[0]?.event).toEqual({ type: "a" })
      expect(events[1]?.sequence).toBe(1)
      expect(events[1]?.event).toEqual({ type: "b" })
    })

    test("yields past events after specified sequence", async () => {
      await store.create("stream-1")
      await store.append("stream-1", { type: "a" })
      await store.append("stream-1", { type: "b" })
      await store.append("stream-1", { type: "c" })
      await store.complete("stream-1")

      const events = []
      for await (const event of store.subscribe("stream-1", 0)) {
        events.push(event)
      }

      expect(events.length).toBe(2)
      expect(events[0]?.event).toEqual({ type: "b" })
      expect(events[1]?.event).toEqual({ type: "c" })
    })

    test("yields live events from active stream", async () => {
      await store.create("stream-1")

      const events: unknown[] = []
      const subscribePromise = (async () => {
        for await (const event of store.subscribe("stream-1")) {
          events.push(event.event)
          if (events.length >= 2) break
        }
      })()

      // Give subscriber time to start
      await new Promise((r) => setTimeout(r, 10))

      await store.append("stream-1", { type: "live-1" })
      await store.append("stream-1", { type: "live-2" })

      await subscribePromise

      expect(events).toEqual([{ type: "live-1" }, { type: "live-2" }])
    })

    test("stops yielding when stream completes", async () => {
      await store.create("stream-1")

      const events: unknown[] = []
      const subscribePromise = (async () => {
        for await (const event of store.subscribe("stream-1")) {
          events.push(event.event)
        }
      })()

      // Give subscriber time to start
      await new Promise((r) => setTimeout(r, 10))

      await store.append("stream-1", { type: "event-1" })
      await store.complete("stream-1")

      await subscribePromise

      expect(events).toEqual([{ type: "event-1" }])
    })

    test("throws when stream does not exist", async () => {
      const gen = store.subscribe("non-existent")
      await expect(gen.next()).rejects.toThrow("Stream not found")
    })

    test("includes timestamps in events", async () => {
      await store.create("stream-1")
      const before = new Date()
      await store.append("stream-1", { type: "test" })
      const after = new Date()
      await store.complete("stream-1")

      const events = []
      for await (const event of store.subscribe("stream-1")) {
        events.push(event)
      }

      expect(events[0]?.timestamp).toBeInstanceOf(Date)
      expect(events[0]?.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(events[0]?.timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })

  describe("dispose", () => {
    test("clears all streams", async () => {
      await store.create("stream-1")
      await store.create("stream-2")

      await store.dispose()

      expect(await store.get("stream-1")).toBeNull()
      expect(await store.get("stream-2")).toBeNull()
    })

    test("closes active subscriptions", async () => {
      await store.create("stream-1")

      const events: unknown[] = []
      const subscribePromise = (async () => {
        for await (const event of store.subscribe("stream-1")) {
          events.push(event.event)
        }
      })()

      // Give subscriber time to start
      await new Promise((r) => setTimeout(r, 10))

      await store.dispose()
      await subscribePromise

      // Should complete without errors
      expect(events).toEqual([])
    })
  })

  describe("edge cases", () => {
    test("handles multiple subscribers to same stream", async () => {
      await store.create("stream-1")

      const events1: unknown[] = []
      const events2: unknown[] = []

      const sub1 = (async () => {
        for await (const event of store.subscribe("stream-1")) {
          events1.push(event.event)
        }
      })()

      const sub2 = (async () => {
        for await (const event of store.subscribe("stream-1")) {
          events2.push(event.event)
        }
      })()

      // Give subscribers time to start
      await new Promise((r) => setTimeout(r, 10))

      await store.append("stream-1", { type: "shared-event" })
      await store.complete("stream-1")

      await Promise.all([sub1, sub2])

      expect(events1).toEqual([{ type: "shared-event" }])
      expect(events2).toEqual([{ type: "shared-event" }])
    })

    test("handles rapid append and subscribe", async () => {
      await store.create("stream-1")

      // Append 100 events rapidly
      for (let i = 0; i < 100; i++) {
        await store.append("stream-1", { index: i })
      }
      await store.complete("stream-1")

      const events = []
      for await (const event of store.subscribe("stream-1")) {
        events.push(event)
      }

      expect(events.length).toBe(100)
      expect(events[99]?.event).toEqual({ index: 99 })
    })

    test("stream with no events completes correctly", async () => {
      await store.create("stream-1")
      await store.complete("stream-1")

      const events = []
      for await (const event of store.subscribe("stream-1")) {
        events.push(event)
      }

      expect(events.length).toBe(0)
    })
  })
})
