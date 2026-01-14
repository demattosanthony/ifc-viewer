/**
 * Conversations API E2E Tests
 *
 * Tests for AI conversation management within projects.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type {
  ConversationResponse,
  ConversationWithMessagesResponse,
  ErrorResponse,
  SuccessResponse,
} from "@ifc-viewer/interface"
import { createTestApp, type TestApp, TestClient } from "../utils/index.ts"

describe("Conversations API", () => {
  let testApp: TestApp
  let client: TestClient
  const PROJECT_ID = "test-project"

  beforeEach(async () => {
    testApp = await createTestApp()
    client = new TestClient(testApp.app)
    await client.post("/api/projects", { id: PROJECT_ID })
  })

  afterEach(async () => {
    await testApp.dispose()
  })

  describe("POST /api/projects/:id/conversations", () => {
    test("creates a new conversation", async () => {
      const res = await client.post<ConversationResponse>(
        `/api/projects/${PROJECT_ID}/conversations`,
        {}
      )

      expect(res.status).toBe(200)
      expect(res.data.id).toBeDefined()
      expect(res.data.projectId).toBe(PROJECT_ID)
      expect(res.data.status).toBe("active")
    })

    test("creates conversation with title", async () => {
      const res = await client.post<ConversationResponse>(
        `/api/projects/${PROJECT_ID}/conversations`,
        { title: "Test Conversation" }
      )

      expect(res.status).toBe(200)
      expect(res.data.title).toBe("Test Conversation")
    })

    test("creates conversation with null title when not provided", async () => {
      const res = await client.post<ConversationResponse>(
        `/api/projects/${PROJECT_ID}/conversations`,
        {}
      )

      expect(res.status).toBe(200)
      expect(res.data.title).toBeNull()
    })

    test("returns 404 for non-existent project", async () => {
      const res = await client.post<ErrorResponse>("/api/projects/non-existent/conversations", {})

      expect(res.status).toBe(404)
    })
  })

  describe("GET /api/projects/:id/conversations", () => {
    test("returns empty list initially", async () => {
      const res = await client.get<ConversationResponse[]>(
        `/api/projects/${PROJECT_ID}/conversations`
      )

      expect(res.status).toBe(200)
      expect(res.data).toEqual([])
    })

    test("returns created conversations", async () => {
      await client.post(`/api/projects/${PROJECT_ID}/conversations`, {})
      await client.post(`/api/projects/${PROJECT_ID}/conversations`, {})

      const res = await client.get<ConversationResponse[]>(
        `/api/projects/${PROJECT_ID}/conversations`
      )

      expect(res.status).toBe(200)
      expect(res.data).toHaveLength(2)
    })

    test("returns 404 for non-existent project", async () => {
      const res = await client.get<ErrorResponse>("/api/projects/non-existent/conversations")

      expect(res.status).toBe(404)
    })
  })

  describe("GET /api/projects/:id/conversations/:conversationId", () => {
    test("returns conversation by id with messages", async () => {
      const createRes = await client.post<ConversationResponse>(
        `/api/projects/${PROJECT_ID}/conversations`,
        { title: "My Conversation" }
      )
      const convId = createRes.data.id

      const res = await client.get<ConversationWithMessagesResponse>(
        `/api/projects/${PROJECT_ID}/conversations/${convId}`
      )

      expect(res.status).toBe(200)
      expect(res.data.id).toBe(convId)
      expect(res.data.messages).toEqual([])
      expect(res.data.isGenerating).toBe(false)
    })

    test("returns 404 for non-existent conversation", async () => {
      // Using a valid UUID format that doesn't exist
      const res = await client.get<ErrorResponse>(
        `/api/projects/${PROJECT_ID}/conversations/00000000-0000-0000-0000-000000000000`
      )

      expect(res.status).toBe(404)
    })
  })

  describe("DELETE /api/projects/:id/conversations/:conversationId", () => {
    test("deletes existing conversation", async () => {
      const createRes = await client.post<ConversationResponse>(
        `/api/projects/${PROJECT_ID}/conversations`,
        {}
      )
      const convId = createRes.data.id

      const deleteRes = await client.delete<SuccessResponse>(
        `/api/projects/${PROJECT_ID}/conversations/${convId}`
      )
      expect(deleteRes.status).toBe(200)
      expect(deleteRes.data.success).toBe(true)

      const getRes = await client.get(`/api/projects/${PROJECT_ID}/conversations/${convId}`)
      expect(getRes.status).toBe(404)
    })

    test("removes conversation from list", async () => {
      const conv1 = await client.post<ConversationResponse>(
        `/api/projects/${PROJECT_ID}/conversations`,
        { title: "First" }
      )
      await client.post(`/api/projects/${PROJECT_ID}/conversations`, { title: "Second" })

      await client.delete(`/api/projects/${PROJECT_ID}/conversations/${conv1.data.id}`)

      const listRes = await client.get<ConversationResponse[]>(
        `/api/projects/${PROJECT_ID}/conversations`
      )
      expect(listRes.data).toHaveLength(1)
      expect(listRes.data[0]?.title).toBe("Second")
    })
  })

  describe("DELETE /api/projects/:id/conversations (clear all)", () => {
    test("clears all conversations for project", async () => {
      await client.post(`/api/projects/${PROJECT_ID}/conversations`, {})
      await client.post(`/api/projects/${PROJECT_ID}/conversations`, {})
      await client.post(`/api/projects/${PROJECT_ID}/conversations`, {})

      const deleteRes = await client.delete<SuccessResponse>(
        `/api/projects/${PROJECT_ID}/conversations`
      )
      expect(deleteRes.status).toBe(200)
      expect(deleteRes.data.success).toBe(true)

      const listRes = await client.get<ConversationResponse[]>(
        `/api/projects/${PROJECT_ID}/conversations`
      )
      expect(listRes.data).toHaveLength(0)
    })
  })

  // Note: Testing /messages and /events endpoints requires a functioning AI provider
  // These tests are limited to basic validation without actual AI generation
  describe("POST /api/projects/:id/conversations/:conversationId/messages", () => {
    test("returns 404 for non-existent conversation", async () => {
      const res = await client.post<ErrorResponse>(
        `/api/projects/${PROJECT_ID}/conversations/00000000-0000-0000-0000-000000000000/messages`,
        { content: "Hello" }
      )

      expect(res.status).toBe(404)
    })
  })

  describe("POST /api/projects/:id/conversations/:conversationId/stop", () => {
    test("returns 404 when no active generation", async () => {
      const createRes = await client.post<ConversationResponse>(
        `/api/projects/${PROJECT_ID}/conversations`,
        {}
      )
      const convId = createRes.data.id

      const res = await client.post<ErrorResponse>(
        `/api/projects/${PROJECT_ID}/conversations/${convId}/stop`,
        {}
      )

      expect(res.status).toBe(404)
      expect(res.data.error).toBe("No active generation")
    })
  })
})
