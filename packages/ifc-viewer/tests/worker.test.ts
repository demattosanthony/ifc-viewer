import { describe, expect, test } from "bun:test"
import { CDN_WORKER_URL, FRAGMENTS_VERSION } from "../src/worker/index"

describe("Worker utilities", () => {
  test("CDN_WORKER_URL is valid and returns JavaScript", async () => {
    const response = await fetch(CDN_WORKER_URL, { method: "HEAD" })

    expect(response.ok).toBe(true)
    expect(response.status).toBe(200)

    const contentType = response.headers.get("content-type")
    expect(contentType).toContain("javascript")
  })

  test("FRAGMENTS_VERSION is a valid semver", () => {
    // Should be a valid semver like "3.2.13"
    expect(FRAGMENTS_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test("CDN_WORKER_URL contains correct path structure", () => {
    // Uses @ademattos/fragments for the worker (custom fork)
    expect(CDN_WORKER_URL).toContain("unpkg.com/@ademattos/fragments@")
    expect(CDN_WORKER_URL).toContain("/dist/Worker/worker.mjs")
    expect(CDN_WORKER_URL).toContain(FRAGMENTS_VERSION)
  })
})
