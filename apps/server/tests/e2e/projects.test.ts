/**
 * Projects API E2E Tests
 *
 * Tests for CRUD operations on projects.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { ErrorResponse, ProjectResponse } from "@ifc-viewer/interface"
import { createTestApp, type TestApp, TestClient } from "../utils/index.ts"

describe("Projects API", () => {
  let testApp: TestApp
  let client: TestClient

  beforeEach(async () => {
    testApp = await createTestApp()
    client = new TestClient(testApp.app)
  })

  afterEach(async () => {
    await testApp.dispose()
  })

  describe("POST /api/projects", () => {
    test("creates a project with valid id", async () => {
      const res = await client.post<ProjectResponse>("/api/projects", { id: "my-project" })

      expect(res.status).toBe(200)
      expect(res.data).toMatchObject({
        id: "my-project",
        description: null,
      })
    })

    test("creates a project with description", async () => {
      const res = await client.post<ProjectResponse>("/api/projects", {
        id: "my-project",
        description: "Test project",
      })

      expect(res.status).toBe(200)
      expect(res.data.description).toBe("Test project")
    })

    test("sets createdAt and updatedAt timestamps", async () => {
      const res = await client.post<ProjectResponse>("/api/projects", { id: "my-project" })

      expect(res.status).toBe(200)
      expect(res.data.createdAt).toBeDefined()
      expect(res.data.updatedAt).toBeDefined()
    })

    test("rejects invalid project id - uppercase", async () => {
      const res = await client.post<ErrorResponse>("/api/projects", { id: "MyProject" })

      expect(res.status).toBe(400)
      expect(res.data.error).toBeDefined()
    })

    test("rejects invalid project id - special characters", async () => {
      const res = await client.post<ErrorResponse>("/api/projects", { id: "my_project!" })

      expect(res.status).toBe(400)
      expect(res.data.error).toBeDefined()
    })

    test("rejects invalid project id - empty string", async () => {
      const res = await client.post<ErrorResponse>("/api/projects", { id: "" })

      // Zod validation returns 422 for schema validation errors
      expect(res.status).toBe(422)
    })

    test("returns existing project for duplicate id (idempotent)", async () => {
      const first = await client.post<ProjectResponse>("/api/projects", { id: "my-project" })
      const second = await client.post<ProjectResponse>("/api/projects", { id: "my-project" })

      // API is idempotent - returns existing project
      expect(second.status).toBe(200)
      expect(second.data.id).toBe(first.data.id)
    })
  })

  describe("GET /api/projects", () => {
    test("returns empty array initially", async () => {
      const res = await client.get<ProjectResponse[]>("/api/projects")

      expect(res.status).toBe(200)
      expect(res.data).toEqual([])
    })

    test("returns created projects", async () => {
      await client.post("/api/projects", { id: "project-1" })
      await client.post("/api/projects", { id: "project-2" })

      const res = await client.get<ProjectResponse[]>("/api/projects")

      expect(res.status).toBe(200)
      expect(res.data).toHaveLength(2)
    })

    test("returns projects with correct data", async () => {
      await client.post("/api/projects", { id: "test-project", description: "A test" })

      const res = await client.get<ProjectResponse[]>("/api/projects")

      expect(res.status).toBe(200)
      expect(res.data[0]).toMatchObject({
        id: "test-project",
        description: "A test",
      })
    })
  })

  describe("GET /api/projects/:id", () => {
    test("returns project by id", async () => {
      await client.post("/api/projects", { id: "my-project", description: "Test" })

      const res = await client.get<ProjectResponse>("/api/projects/my-project")

      expect(res.status).toBe(200)
      expect(res.data.id).toBe("my-project")
      expect(res.data.description).toBe("Test")
    })

    test("returns 404 for non-existent project", async () => {
      const res = await client.get<ErrorResponse>("/api/projects/non-existent")

      expect(res.status).toBe(404)
    })
  })

  describe("PATCH /api/projects/:id", () => {
    test("updates project description", async () => {
      await client.post("/api/projects", { id: "my-project" })

      const res = await client.patch<ProjectResponse>("/api/projects/my-project", {
        description: "Updated description",
      })

      expect(res.status).toBe(200)
      expect(res.data.description).toBe("Updated description")
    })

    test("updates updatedAt timestamp", async () => {
      const createRes = await client.post<ProjectResponse>("/api/projects", { id: "my-project" })
      const originalUpdatedAt = createRes.data.updatedAt

      // Small delay to ensure different timestamp
      await Bun.sleep(10)

      const updateRes = await client.patch<ProjectResponse>("/api/projects/my-project", {
        description: "Updated",
      })

      expect(new Date(updateRes.data.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime()
      )
    })

    test("returns 404 for non-existent project", async () => {
      const res = await client.patch<ErrorResponse>("/api/projects/non-existent", {
        description: "Test",
      })

      expect(res.status).toBe(404)
    })

    test("preserves description when not provided in update", async () => {
      await client.post("/api/projects", { id: "my-project", description: "Initial" })

      // Update with empty body should preserve existing description
      const res = await client.patch<ProjectResponse>("/api/projects/my-project", {})

      expect(res.status).toBe(200)
      expect(res.data.description).toBe("Initial")
    })
  })

  describe("DELETE /api/projects/:id", () => {
    test("deletes existing project", async () => {
      await client.post("/api/projects", { id: "my-project" })

      const deleteRes = await client.delete("/api/projects/my-project")
      expect(deleteRes.status).toBe(200)

      const getRes = await client.get("/api/projects/my-project")
      expect(getRes.status).toBe(404)
    })

    test("returns 404 for non-existent project", async () => {
      const res = await client.delete<ErrorResponse>("/api/projects/non-existent")

      expect(res.status).toBe(404)
    })

    test("removes project from list", async () => {
      await client.post("/api/projects", { id: "project-1" })
      await client.post("/api/projects", { id: "project-2" })

      await client.delete("/api/projects/project-1")

      const res = await client.get<ProjectResponse[]>("/api/projects")
      expect(res.data).toHaveLength(1)
      expect(res.data[0]?.id).toBe("project-2")
    })
  })
})
