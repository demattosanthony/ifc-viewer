/**
 * Health & Info API E2E Tests
 *
 * Tests for the root and health endpoints.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { ApiInfoResponse, HealthResponse } from "@ifc-viewer/interface"
import { createTestApp, type TestApp, TestClient } from "../utils/index.ts"

describe("Health & Info API", () => {
  let testApp: TestApp
  let client: TestClient

  beforeEach(async () => {
    testApp = await createTestApp()
    client = new TestClient(testApp.app)
  })

  afterEach(async () => {
    await testApp.dispose()
  })

  describe("GET /", () => {
    test("returns API info", async () => {
      const res = await client.get<ApiInfoResponse>("/")

      expect(res.status).toBe(200)
      expect(res.data).toMatchObject({
        message: "IFC Viewer API",
        version: "2.0.0",
        docs: "/swagger",
      })
    })
  })

  describe("GET /health", () => {
    test("returns health status", async () => {
      const res = await client.get<HealthResponse>("/health")

      expect(res.status).toBe(200)
      expect(res.data.status).toBe("ok")
      expect(res.data.timestamp).toBeDefined()
    })

    test("timestamp is valid ISO date", async () => {
      const res = await client.get<HealthResponse>("/health")

      const timestamp = new Date(res.data.timestamp)
      expect(timestamp).toBeInstanceOf(Date)
      expect(timestamp.getTime()).not.toBeNaN()
    })
  })
})
