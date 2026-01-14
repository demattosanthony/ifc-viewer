/**
 * Models API E2E Tests
 *
 * Tests for IFC model management within projects.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { ErrorResponse, ModelResponse } from "@ifc-viewer/interface"
import { createTestApp, type TestApp, TestClient } from "../utils/index.ts"

// Minimal valid IFC file content for testing
const MINIMAL_IFC_CONTENT = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('minimal.ifc','2024-01-01T00:00:00',(''),(''),'','','');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1=IFCPROJECT('0001',#2,'Test',$,$,$,$,$,#3);
#2=IFCOWNERHISTORY(#4,#5,$,.ADDED.,$,$,$,0);
#3=IFCUNITASSIGNMENT((#6));
#4=IFCPERSONANDORGANIZATION(#7,#8,$);
#5=IFCAPPLICATION(#8,'1.0','Test','Test');
#6=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
#7=IFCPERSON($,'Test',$,$,$,$,$,$);
#8=IFCORGANIZATION($,'Test',$,$,$);
ENDSEC;
END-ISO-10303-21;`

describe("Models API", () => {
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

  describe("GET /api/projects/:id/models", () => {
    test("returns empty models list for new project", async () => {
      const res = await client.get<ModelResponse[]>(`/api/projects/${PROJECT_ID}/models`)

      expect(res.status).toBe(200)
      expect(res.data).toEqual([])
    })

    test("returns 404 for non-existent project", async () => {
      const res = await client.get<ErrorResponse>("/api/projects/non-existent/models")

      expect(res.status).toBe(404)
    })
  })

  describe("POST /api/projects/:id/models (upload)", () => {
    test("uploads model with IFC file", async () => {
      const formData = new FormData()
      const blob = new Blob([MINIMAL_IFC_CONTENT], { type: "application/octet-stream" })
      formData.append("file", blob, "test-model.ifc")

      const res = await client.upload<ModelResponse>(`/api/projects/${PROJECT_ID}/models`, formData)

      expect(res.status).toBe(200)
      expect(res.data.projectId).toBe(PROJECT_ID)
      expect(res.data.filePath).toContain("test-model.ifc")
      expect(res.data.name).toBe("test-model")
      expect(res.data.id).toBeDefined()
    })

    test("uploads model with custom name", async () => {
      const formData = new FormData()
      const blob = new Blob([MINIMAL_IFC_CONTENT], { type: "application/octet-stream" })
      formData.append("file", blob, "model.ifc")
      formData.append("name", "My Custom Model")

      const res = await client.upload<ModelResponse>(`/api/projects/${PROJECT_ID}/models`, formData)

      expect(res.status).toBe(200)
      expect(res.data.name).toBe("My Custom Model")
    })

    test("uploads model with discipline", async () => {
      const formData = new FormData()
      const blob = new Blob([MINIMAL_IFC_CONTENT], { type: "application/octet-stream" })
      formData.append("file", blob, "architecture.ifc")
      formData.append("discipline", "architecture")

      const res = await client.upload<ModelResponse>(`/api/projects/${PROJECT_ID}/models`, formData)

      expect(res.status).toBe(200)
      expect(res.data.discipline).toBe("architecture")
    })

    test("returns 404 for non-existent project", async () => {
      const formData = new FormData()
      const blob = new Blob([MINIMAL_IFC_CONTENT], { type: "application/octet-stream" })
      formData.append("file", blob, "model.ifc")

      const res = await client.upload<ErrorResponse>("/api/projects/non-existent/models", formData)

      expect(res.status).toBe(404)
    })
  })

  describe("GET /api/projects/:id/models/:modelId", () => {
    test("returns model by id", async () => {
      // First upload a model
      const formData = new FormData()
      const blob = new Blob([MINIMAL_IFC_CONTENT], { type: "application/octet-stream" })
      formData.append("file", blob, "test.ifc")
      formData.append("name", "Test Model")

      const uploadRes = await client.upload<ModelResponse>(
        `/api/projects/${PROJECT_ID}/models`,
        formData
      )
      const modelId = uploadRes.data.id

      // Then get the model
      const res = await client.get<ModelResponse>(`/api/projects/${PROJECT_ID}/models/${modelId}`)

      expect(res.status).toBe(200)
      expect(res.data.id).toBe(modelId)
      expect(res.data.name).toBe("Test Model")
    })

    test("returns 404 for non-existent model", async () => {
      const res = await client.get<ErrorResponse>(`/api/projects/${PROJECT_ID}/models/non-existent`)

      expect(res.status).toBe(404)
    })
  })

  describe("PATCH /api/projects/:id/models/:modelId", () => {
    test("updates model name", async () => {
      // First upload a model
      const formData = new FormData()
      const blob = new Blob([MINIMAL_IFC_CONTENT], { type: "application/octet-stream" })
      formData.append("file", blob, "test.ifc")

      const uploadRes = await client.upload<ModelResponse>(
        `/api/projects/${PROJECT_ID}/models`,
        formData
      )
      const modelId = uploadRes.data.id

      // Update the name
      const res = await client.patch<ModelResponse>(
        `/api/projects/${PROJECT_ID}/models/${modelId}`,
        { name: "Updated Name" }
      )

      expect(res.status).toBe(200)
      expect(res.data.name).toBe("Updated Name")
    })

    test("updates model discipline", async () => {
      // First upload a model
      const formData = new FormData()
      const blob = new Blob([MINIMAL_IFC_CONTENT], { type: "application/octet-stream" })
      formData.append("file", blob, "test.ifc")

      const uploadRes = await client.upload<ModelResponse>(
        `/api/projects/${PROJECT_ID}/models`,
        formData
      )
      const modelId = uploadRes.data.id

      // Update the discipline
      const res = await client.patch<ModelResponse>(
        `/api/projects/${PROJECT_ID}/models/${modelId}`,
        { discipline: "structure" }
      )

      expect(res.status).toBe(200)
      expect(res.data.discipline).toBe("structure")
    })

    test("returns 404 for non-existent model", async () => {
      const res = await client.patch<ErrorResponse>(
        `/api/projects/${PROJECT_ID}/models/non-existent`,
        { name: "Test" }
      )

      expect(res.status).toBe(404)
    })
  })

  describe("DELETE /api/projects/:id/models/:modelId", () => {
    test("deletes existing model", async () => {
      // First upload a model
      const formData = new FormData()
      const blob = new Blob([MINIMAL_IFC_CONTENT], { type: "application/octet-stream" })
      formData.append("file", blob, "test.ifc")

      const uploadRes = await client.upload<ModelResponse>(
        `/api/projects/${PROJECT_ID}/models`,
        formData
      )
      const modelId = uploadRes.data.id

      // Delete the model
      const deleteRes = await client.delete(`/api/projects/${PROJECT_ID}/models/${modelId}`)
      expect(deleteRes.status).toBe(200)

      // Verify it's gone
      const getRes = await client.get(`/api/projects/${PROJECT_ID}/models/${modelId}`)
      expect(getRes.status).toBe(404)
    })

    test("returns 404 for non-existent model", async () => {
      const res = await client.delete<ErrorResponse>(
        `/api/projects/${PROJECT_ID}/models/non-existent`
      )

      expect(res.status).toBe(404)
    })

    test("removes model from list", async () => {
      // Upload two models
      const formData1 = new FormData()
      const blob1 = new Blob([MINIMAL_IFC_CONTENT], { type: "application/octet-stream" })
      formData1.append("file", blob1, "model1.ifc")
      const upload1 = await client.upload<ModelResponse>(
        `/api/projects/${PROJECT_ID}/models`,
        formData1
      )

      const formData2 = new FormData()
      const blob2 = new Blob([MINIMAL_IFC_CONTENT], { type: "application/octet-stream" })
      formData2.append("file", blob2, "model2.ifc")
      await client.upload(`/api/projects/${PROJECT_ID}/models`, formData2)

      // Delete first model
      await client.delete(`/api/projects/${PROJECT_ID}/models/${upload1.data.id}`)

      // Check list
      const listRes = await client.get<ModelResponse[]>(`/api/projects/${PROJECT_ID}/models`)
      expect(listRes.data).toHaveLength(1)
      expect(listRes.data[0]?.filePath).toContain("model2.ifc")
    })
  })
})
