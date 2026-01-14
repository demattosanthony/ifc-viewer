/**
 * Project Files API E2E Tests
 *
 * Tests for file operations within projects.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type {
  ErrorResponse,
  ListFilesResponse,
  ReadFileResponse,
  SuccessWithPathResponse,
} from "@ifc-viewer/interface"
import { createTestApp, type TestApp, TestClient } from "../utils/index.ts"

describe("Project Files API", () => {
  let testApp: TestApp
  let client: TestClient
  const PROJECT_ID = "test-project"

  beforeEach(async () => {
    testApp = await createTestApp()
    client = new TestClient(testApp.app)
    // Create a project for file tests
    await client.post("/api/projects", { id: PROJECT_ID })
  })

  afterEach(async () => {
    await testApp.dispose()
  })

  describe("GET /api/projects/:id/files", () => {
    test("returns initial files for new project", async () => {
      const res = await client.get<ListFilesResponse>(`/api/projects/${PROJECT_ID}/files?path=.`)

      expect(res.status).toBe(200)
      expect(res.data.path).toBe(".")
      // Dotfiles are hidden from the API, so a new project appears empty
      expect(res.data.files).toEqual([])
    })

    test("returns files after writing", async () => {
      await client.post(`/api/projects/${PROJECT_ID}/files/content`, {
        path: "hello.txt",
        content: "Hello, World!",
      })

      const res = await client.get<ListFilesResponse>(`/api/projects/${PROJECT_ID}/files?path=.`)

      expect(res.status).toBe(200)
      // Should include the new file (plus .gitkeep)
      const helloFile = res.data.files.find((f) => f.name === "hello.txt")
      expect(helloFile).toBeDefined()
      expect(helloFile?.type).toBe("file")
    })

    test("lists files in subdirectory", async () => {
      await client.post(`/api/projects/${PROJECT_ID}/files/content`, {
        path: "src/index.ts",
        content: "export {}",
      })

      const res = await client.get<ListFilesResponse>(`/api/projects/${PROJECT_ID}/files?path=src`)

      expect(res.status).toBe(200)
      expect(res.data.files).toHaveLength(1)
      expect(res.data.files[0]?.name).toBe("index.ts")
    })
  })

  describe("POST /api/projects/:id/files/content", () => {
    test("creates a new file", async () => {
      const res = await client.post<SuccessWithPathResponse>(
        `/api/projects/${PROJECT_ID}/files/content`,
        {
          path: "hello.txt",
          content: "Hello, World!",
        }
      )

      expect(res.status).toBe(200)
      expect(res.data.path).toBe("hello.txt")
      expect(res.data.success).toBe(true)
    })

    test("creates nested file with directories", async () => {
      const res = await client.post<SuccessWithPathResponse>(
        `/api/projects/${PROJECT_ID}/files/content`,
        {
          path: "src/utils/helper.ts",
          content: "export const helper = () => {}",
        }
      )

      expect(res.status).toBe(200)
      expect(res.data.path).toBe("src/utils/helper.ts")
    })

    test("overwrites existing file", async () => {
      await client.post(`/api/projects/${PROJECT_ID}/files/content`, {
        path: "test.txt",
        content: "Original",
      })

      await client.post(`/api/projects/${PROJECT_ID}/files/content`, {
        path: "test.txt",
        content: "Updated",
      })

      const readRes = await client.get<ReadFileResponse>(
        `/api/projects/${PROJECT_ID}/files/content?path=test.txt`
      )

      expect(readRes.data.content).toBe("Updated")
    })

    test("returns 404 for non-existent project", async () => {
      const res = await client.post<ErrorResponse>("/api/projects/non-existent/files/content", {
        path: "test.txt",
        content: "Test",
      })

      expect(res.status).toBe(404)
    })
  })

  describe("GET /api/projects/:id/files/content", () => {
    test("reads file content", async () => {
      await client.post(`/api/projects/${PROJECT_ID}/files/content`, {
        path: "test.txt",
        content: "Test content",
      })

      const res = await client.get<ReadFileResponse>(
        `/api/projects/${PROJECT_ID}/files/content?path=test.txt`
      )

      expect(res.status).toBe(200)
      expect(res.data.content).toBe("Test content")
      expect(res.data.type).toBe("text")
      expect(res.data.path).toBe("test.txt")
    })

    test("returns 404 for non-existent file", async () => {
      const res = await client.get<ErrorResponse>(
        `/api/projects/${PROJECT_ID}/files/content?path=nonexistent.txt`
      )

      expect(res.status).toBe(404)
    })

    test("reads nested file", async () => {
      await client.post(`/api/projects/${PROJECT_ID}/files/content`, {
        path: "src/main.ts",
        content: 'console.log("hello")',
      })

      const res = await client.get<ReadFileResponse>(
        `/api/projects/${PROJECT_ID}/files/content?path=src/main.ts`
      )

      expect(res.status).toBe(200)
      expect(res.data.content).toBe('console.log("hello")')
    })
  })

  describe("DELETE /api/projects/:id/files", () => {
    test("deletes existing file", async () => {
      await client.post(`/api/projects/${PROJECT_ID}/files/content`, {
        path: "to-delete.txt",
        content: "Delete me",
      })

      const deleteRes = await client.delete<SuccessWithPathResponse>(
        `/api/projects/${PROJECT_ID}/files?path=to-delete.txt`
      )
      expect(deleteRes.status).toBe(200)
      expect(deleteRes.data.success).toBe(true)

      const getRes = await client.get(
        `/api/projects/${PROJECT_ID}/files/content?path=to-delete.txt`
      )
      expect(getRes.status).toBe(404)
    })

    test("returns 404 for non-existent project", async () => {
      const res = await client.delete<ErrorResponse>(
        "/api/projects/non-existent/files?path=test.txt"
      )

      expect(res.status).toBe(404)
    })
  })

  describe("POST /api/projects/:id/files/directory", () => {
    test("creates directory", async () => {
      const res = await client.post<SuccessWithPathResponse>(
        `/api/projects/${PROJECT_ID}/files/directory`,
        {
          path: "new-folder",
        }
      )

      expect(res.status).toBe(200)
      expect(res.data.success).toBe(true)
      expect(res.data.path).toBe("new-folder")
    })

    test("creates nested directory", async () => {
      const res = await client.post<SuccessWithPathResponse>(
        `/api/projects/${PROJECT_ID}/files/directory`,
        {
          path: "src/components/ui",
        }
      )

      expect(res.status).toBe(200)
      expect(res.data.path).toBe("src/components/ui")
    })

    test("returns 404 for non-existent project", async () => {
      const res = await client.post<ErrorResponse>("/api/projects/non-existent/files/directory", {
        path: "test",
      })

      expect(res.status).toBe(404)
    })
  })

  describe("POST /api/projects/:id/files/upload", () => {
    test("uploads file via multipart", async () => {
      const formData = new FormData()
      const blob = new Blob(["File content"], { type: "text/plain" })
      formData.append("file", blob, "uploaded.txt")
      formData.append("path", "uploaded.txt")

      const res = await client.upload<SuccessWithPathResponse>(
        `/api/projects/${PROJECT_ID}/files/upload`,
        formData
      )

      expect(res.status).toBe(200)
      expect(res.data.success).toBe(true)

      // Verify file was uploaded
      const readRes = await client.get<ReadFileResponse>(
        `/api/projects/${PROJECT_ID}/files/content?path=uploaded.txt`
      )
      expect(readRes.data.content).toBe("File content")
    })
  })
})
