/**
 * Domain Entity Tests
 *
 * Tests for entity factory functions and helper predicates.
 */

import { describe, expect, test } from "bun:test"
import type { Conversation, Message } from "../../src/domain"
import {
  createProject,
  isAssistantMessage,
  isConversationActive,
  isSystemMessage,
  isUserMessage,
  isValidProjectId,
} from "../../src/domain"

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
    content: "test message",
    createdAt: new Date(),
  })

  describe("isUserMessage", () => {
    test("returns true for user role", () => {
      const msg = createMessage("user")
      expect(isUserMessage(msg)).toBe(true)
    })

    test("returns false for assistant role", () => {
      const msg = createMessage("assistant")
      expect(isUserMessage(msg)).toBe(false)
    })

    test("returns false for system role", () => {
      const msg = createMessage("system")
      expect(isUserMessage(msg)).toBe(false)
    })
  })

  describe("isAssistantMessage", () => {
    test("returns true for assistant role", () => {
      const msg = createMessage("assistant")
      expect(isAssistantMessage(msg)).toBe(true)
    })

    test("returns false for user role", () => {
      const msg = createMessage("user")
      expect(isAssistantMessage(msg)).toBe(false)
    })

    test("returns false for system role", () => {
      const msg = createMessage("system")
      expect(isAssistantMessage(msg)).toBe(false)
    })
  })

  describe("isSystemMessage", () => {
    test("returns true for system role", () => {
      const msg = createMessage("system")
      expect(isSystemMessage(msg)).toBe(true)
    })

    test("returns false for user role", () => {
      const msg = createMessage("user")
      expect(isSystemMessage(msg)).toBe(false)
    })

    test("returns false for assistant role", () => {
      const msg = createMessage("assistant")
      expect(isSystemMessage(msg)).toBe(false)
    })
  })
})
