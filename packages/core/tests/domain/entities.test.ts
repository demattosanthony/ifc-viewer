/**
 * Domain Entity Tests
 *
 * Tests for entity factory functions and helper predicates.
 */

import { describe, expect, test } from "bun:test"
import type { Conversation, Message } from "../../src/domain"
import { createProject, isConversationActive, isValidProjectId } from "../../src/domain"

describe("Project Entity", () => {
  describe("createProject", () => {
    test("creates project with valid slug", () => {
      const project = createProject({ id: "my-project" })

      expect(project.id).toBe("my-project")
      expect(project.description).toBeNull()
      expect(project.createdAt).toBeInstanceOf(Date)
      expect(project.updatedAt).toBeInstanceOf(Date)
    })

    test("creates project with description", () => {
      const project = createProject({
        id: "my-project",
        description: "A test project",
      })

      expect(project.description).toBe("A test project")
    })

    test("creates project with null description", () => {
      const project = createProject({
        id: "my-project",
        description: null,
      })

      expect(project.description).toBeNull()
    })

    test("sets createdAt and updatedAt to same time", () => {
      const project = createProject({ id: "test" })
      expect(project.createdAt.getTime()).toBe(project.updatedAt.getTime())
    })

    test("throws for invalid slug - uppercase", () => {
      expect(() => createProject({ id: "MyProject" })).toThrow()
    })

    test("throws for invalid slug - empty", () => {
      expect(() => createProject({ id: "" })).toThrow()
    })

    test("throws for invalid slug - special characters", () => {
      expect(() => createProject({ id: "my_project" })).toThrow()
    })

    test("throws for invalid slug - consecutive hyphens", () => {
      expect(() => createProject({ id: "my--project" })).toThrow()
    })
  })

  describe("isValidProjectId", () => {
    test("returns true for valid slugs", () => {
      expect(isValidProjectId("my-project")).toBe(true)
      expect(isValidProjectId("a")).toBe(true)
      expect(isValidProjectId("test123")).toBe(true)
    })

    test("returns false for invalid slugs", () => {
      expect(isValidProjectId("MyProject")).toBe(false)
      expect(isValidProjectId("")).toBe(false)
      expect(isValidProjectId("my--project")).toBe(false)
    })
  })
})

describe("Conversation Entity", () => {
  describe("isConversationActive", () => {
    const createConversation = (status: Conversation["status"]): Conversation => ({
      id: "conv-123",
      projectId: "project",
      title: null,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    test("returns true for 'active' status", () => {
      const conv = createConversation("active")
      expect(isConversationActive(conv)).toBe(true)
    })

    test("returns true for 'streaming' status", () => {
      const conv = createConversation("streaming")
      expect(isConversationActive(conv)).toBe(true)
    })

    test("returns false for 'completed' status", () => {
      const conv = createConversation("completed")
      expect(isConversationActive(conv)).toBe(false)
    })

    test("returns false for 'aborted' status", () => {
      const conv = createConversation("aborted")
      expect(isConversationActive(conv)).toBe(false)
    })
  })
})

describe("Message Entity", () => {
  const createMessage = (role: Message["role"]): Message => ({
    id: "msg-123",
    conversationId: "conv-123",
    role,
    parts: [{ type: "text", text: "test message" }],
    createdAt: new Date(),
  })

  test("creates message with text part", () => {
    const msg = createMessage("user")
    expect(msg.parts).toHaveLength(1)
    expect(msg.parts[0]?.type).toBe("text")
  })

  test("creates message with user role", () => {
    const msg = createMessage("user")
    expect(msg.role).toBe("user")
  })

  test("creates message with assistant role", () => {
    const msg = createMessage("assistant")
    expect(msg.role).toBe("assistant")
  })

  test("creates message with system role", () => {
    const msg = createMessage("system")
    expect(msg.role).toBe("system")
  })
})
