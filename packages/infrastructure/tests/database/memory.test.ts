/**
 * Memory Repository Tests
 *
 * Tests for the in-memory repository implementations.
 */

import { beforeEach, describe, expect, test } from "bun:test"
import type { ConversationRepository, MessageRepository, ProjectRepository } from "@ifc-viewer/core"
import { generateId } from "@ifc-viewer/core"
import { createConversationRepository } from "../../src/database/memory/conversation.repository"
import { createMessageRepository } from "../../src/database/memory/message.repository"
import { createProjectRepository } from "../../src/database/memory/project.repository"

describe("ProjectRepository", () => {
  let repo: ProjectRepository

  beforeEach(() => {
    repo = createProjectRepository()
  })

  describe("create", () => {
    test("creates project with required fields", async () => {
      const project = await repo.create({ id: "my-project" })

      expect(project.id).toBe("my-project")
      expect(project.description).toBeNull()
      expect(project.createdAt).toBeInstanceOf(Date)
      expect(project.updatedAt).toBeInstanceOf(Date)
    })

    test("creates project with optional description", async () => {
      const project = await repo.create({
        id: "my-project",
        description: "A test project",
      })

      expect(project.description).toBe("A test project")
    })

    test("sets createdAt and updatedAt to same time", async () => {
      const project = await repo.create({ id: "my-project" })
      expect(project.createdAt.getTime()).toBe(project.updatedAt.getTime())
    })
  })

  describe("findById", () => {
    test("returns project by id", async () => {
      await repo.create({ id: "my-project" })

      const found = await repo.findById("my-project")
      expect(found).not.toBeNull()
      expect(found!.id).toBe("my-project")
    })

    test("returns null for non-existent id", async () => {
      const found = await repo.findById("non-existent")
      expect(found).toBeNull()
    })
  })

  describe("findAll", () => {
    test("returns empty array when no projects", async () => {
      const all = await repo.findAll()
      expect(all).toEqual([])
    })

    test("returns all projects", async () => {
      await repo.create({ id: "project-1" })
      await repo.create({ id: "project-2" })
      await repo.create({ id: "project-3" })

      const all = await repo.findAll()
      expect(all.length).toBe(3)
      expect(all.map((p) => p.id).sort()).toEqual(["project-1", "project-2", "project-3"])
    })
  })

  describe("update", () => {
    test("updates description", async () => {
      await repo.create({ id: "my-project" })

      const updated = await repo.update("my-project", {
        description: "Updated description",
      })

      expect(updated.description).toBe("Updated description")
    })

    test("updates updatedAt timestamp", async () => {
      const created = await repo.create({ id: "my-project" })
      const originalUpdatedAt = created.updatedAt

      // Wait a tiny bit to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10))

      const updated = await repo.update("my-project", {
        description: "new",
      })

      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    test("preserves fields not being updated", async () => {
      const created = await repo.create({
        id: "my-project",
        description: "original",
      })

      const updated = await repo.update("my-project", {})

      expect(updated.id).toBe(created.id)
      expect(updated.description).toBe("original")
      expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime())
    })

    test("throws for non-existent project", async () => {
      await expect(repo.update("non-existent", { description: "test" })).rejects.toThrow()
    })
  })

  describe("delete", () => {
    test("removes project", async () => {
      await repo.create({ id: "my-project" })
      expect(await repo.findById("my-project")).not.toBeNull()

      await repo.delete("my-project")
      expect(await repo.findById("my-project")).toBeNull()
    })

    test("does not throw for non-existent project", async () => {
      await expect(repo.delete("non-existent")).resolves.toBeUndefined()
    })
  })
})

describe("ConversationRepository", () => {
  let repo: ConversationRepository

  beforeEach(() => {
    repo = createConversationRepository()
  })

  describe("create", () => {
    test("creates conversation with generated UUID", async () => {
      const conv = await repo.create({ projectId: "project" })

      expect(conv.id).toBeDefined()
      expect(conv.id.length).toBe(36)
      expect(conv.projectId).toBe("project")
      expect(conv.title).toBeNull()
      expect(conv.status).toBe("active")
      expect(conv.createdAt).toBeInstanceOf(Date)
      expect(conv.updatedAt).toBeInstanceOf(Date)
    })

    test("creates conversation with optional title", async () => {
      const conv = await repo.create({
        projectId: "project",
        title: "My Conversation",
      })

      expect(conv.title).toBe("My Conversation")
    })
  })

  describe("findById", () => {
    test("returns conversation by id", async () => {
      const created = await repo.create({ projectId: "project" })

      const found = await repo.findById(created.id)
      expect(found).not.toBeNull()
      expect(found!.id).toBe(created.id)
    })

    test("returns null for non-existent id", async () => {
      const found = await repo.findById("non-existent")
      expect(found).toBeNull()
    })
  })

  describe("findByProjectId", () => {
    test("returns conversations sorted by updatedAt descending", async () => {
      const c1 = await repo.create({ projectId: "project" })
      await new Promise((r) => setTimeout(r, 10))
      const c2 = await repo.create({ projectId: "project" })
      await new Promise((r) => setTimeout(r, 10))
      const c3 = await repo.create({ projectId: "project" })

      const results = await repo.findByProjectId("project")

      expect(results.length).toBe(3)
      // Most recent first
      expect(results[0]!.id).toBe(c3.id)
      expect(results[1]!.id).toBe(c2.id)
      expect(results[2]!.id).toBe(c1.id)
    })

    test("returns empty array for project with no conversations", async () => {
      const results = await repo.findByProjectId("non-existent")
      expect(results).toEqual([])
    })
  })

  describe("update", () => {
    test("updates title", async () => {
      const created = await repo.create({ projectId: "project" })

      const updated = await repo.update(created.id, { title: "New Title" })
      expect(updated.title).toBe("New Title")
    })

    test("can set title to null", async () => {
      const created = await repo.create({ projectId: "project", title: "Original" })

      const updated = await repo.update(created.id, { title: null })
      expect(updated.title).toBeNull()
    })

    test("updates status", async () => {
      const created = await repo.create({ projectId: "project" })

      const updated = await repo.update(created.id, { status: "completed" })
      expect(updated.status).toBe("completed")
    })

    test("updates updatedAt timestamp", async () => {
      const created = await repo.create({ projectId: "project" })
      const originalTime = created.updatedAt

      await new Promise((r) => setTimeout(r, 10))

      const updated = await repo.update(created.id, { title: "new" })
      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalTime.getTime())
    })

    test("throws for non-existent conversation", async () => {
      await expect(repo.update("non-existent", { title: "test" })).rejects.toThrow()
    })
  })

  describe("delete", () => {
    test("removes conversation", async () => {
      const created = await repo.create({ projectId: "project" })

      await repo.delete(created.id)
      expect(await repo.findById(created.id)).toBeNull()
    })
  })

  describe("deleteByProjectId", () => {
    test("removes all conversations for project", async () => {
      await repo.create({ projectId: "project-1" })
      await repo.create({ projectId: "project-1" })
      await repo.create({ projectId: "project-2" })

      await repo.deleteByProjectId("project-1")

      const remaining1 = await repo.findByProjectId("project-1")
      const remaining2 = await repo.findByProjectId("project-2")

      expect(remaining1.length).toBe(0)
      expect(remaining2.length).toBe(1)
    })
  })
})

describe("MessageRepository", () => {
  let repo: MessageRepository

  beforeEach(() => {
    repo = createMessageRepository()
  })

  describe("create", () => {
    test("creates message with generated UUID", async () => {
      const conversationId = generateId()
      const message = await repo.create({
        conversationId,
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      })

      expect(message.id).toBeDefined()
      expect(message.id.length).toBe(36)
      expect(message.conversationId).toBe(conversationId)
      expect(message.role).toBe("user")
      expect(message.parts).toHaveLength(1)
      expect(message.parts[0]).toEqual({ type: "text", text: "Hello" })
      expect(message.createdAt).toBeInstanceOf(Date)
    })

    test("creates user message", async () => {
      const message = await repo.create({
        conversationId: generateId(),
        role: "user",
        parts: [{ type: "text", text: "User message" }],
      })

      expect(message.role).toBe("user")
    })

    test("creates assistant message", async () => {
      const message = await repo.create({
        conversationId: generateId(),
        role: "assistant",
        parts: [{ type: "text", text: "Assistant message" }],
      })

      expect(message.role).toBe("assistant")
    })
  })

  describe("findByConversationId", () => {
    test("returns messages sorted by createdAt ascending", async () => {
      const conversationId = generateId()
      const m1 = await repo.create({
        conversationId,
        role: "user",
        parts: [{ type: "text", text: "First" }],
      })
      await new Promise((r) => setTimeout(r, 10))
      const m2 = await repo.create({
        conversationId,
        role: "assistant",
        parts: [{ type: "text", text: "Second" }],
      })
      await new Promise((r) => setTimeout(r, 10))
      const m3 = await repo.create({
        conversationId,
        role: "user",
        parts: [{ type: "text", text: "Third" }],
      })

      const messages = await repo.findByConversationId(conversationId)

      expect(messages.length).toBe(3)
      // Oldest first (chronological order)
      expect(messages[0]!.id).toBe(m1.id)
      expect(messages[1]!.id).toBe(m2.id)
      expect(messages[2]!.id).toBe(m3.id)
    })

    test("only returns messages for specified conversation", async () => {
      const conv1 = generateId()
      const conv2 = generateId()
      await repo.create({
        conversationId: conv1,
        role: "user",
        parts: [{ type: "text", text: "A" }],
      })
      await repo.create({
        conversationId: conv2,
        role: "user",
        parts: [{ type: "text", text: "B" }],
      })
      await repo.create({
        conversationId: conv1,
        role: "user",
        parts: [{ type: "text", text: "C" }],
      })

      const messages = await repo.findByConversationId(conv1)

      expect(messages.length).toBe(2)
      expect(messages.every((m) => m.conversationId === conv1)).toBe(true)
    })

    test("returns empty array for conversation with no messages", async () => {
      const messages = await repo.findByConversationId(generateId())
      expect(messages).toEqual([])
    })
  })
})
