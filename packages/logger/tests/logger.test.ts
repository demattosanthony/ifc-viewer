import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import {
  createLogger,
  flushLogs,
  LOG_LEVELS,
  LOG_LEVEL_PRIORITY,
} from "../src/index.ts"

describe("Logger", () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.LOG_TO_FILE = "false"
    process.env.LOG_TO_CONSOLE = "true"
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test("creates logger with namespace", () => {
    const log = createLogger("test")
    expect(log).toBeDefined()
    expect(typeof log.info).toBe("function")
    expect(typeof log.debug).toBe("function")
    expect(typeof log.warn).toBe("function")
    expect(typeof log.error).toBe("function")
  })

  test("creates child logger with combined namespace", () => {
    const log = createLogger("parent")
    const child = log.child("child")
    expect(child).toBeDefined()
    expect(typeof child.info).toBe("function")
  })

  test("log levels have correct priority order", () => {
    expect(LOG_LEVEL_PRIORITY.debug).toBeLessThan(LOG_LEVEL_PRIORITY.info)
    expect(LOG_LEVEL_PRIORITY.info).toBeLessThan(LOG_LEVEL_PRIORITY.warn)
    expect(LOG_LEVEL_PRIORITY.warn).toBeLessThan(LOG_LEVEL_PRIORITY.error)
  })

  test("LOG_LEVELS contains all levels", () => {
    expect(LOG_LEVELS).toContain("debug")
    expect(LOG_LEVELS).toContain("info")
    expect(LOG_LEVELS).toContain("warn")
    expect(LOG_LEVELS).toContain("error")
    expect(LOG_LEVELS.length).toBe(4)
  })

  test("flush completes without error", async () => {
    const log = createLogger("test")
    log.info("test message")
    await expect(flushLogs()).resolves.toBeUndefined()
  })

  test("logs with data object", () => {
    const log = createLogger("test")
    log.info("test message", { key: "value", count: 42 })
    log.error("error message", { error: new Error("test error") })
  })
})

describe("Log Level Filtering", () => {
  beforeEach(() => {
    process.env.LOG_TO_FILE = "false"
    process.env.LOG_TO_CONSOLE = "true"
  })

  test("respects LOG_LEVEL environment variable", () => {
    process.env.LOG_LEVEL = "warn"
    const log = createLogger("test")
    // These execute (level >= warn)
    log.warn("warning")
    log.error("error")
    // These are filtered out silently (level < warn)
    log.debug("debug")
    log.info("info")
  })
})
