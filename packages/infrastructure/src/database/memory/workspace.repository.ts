import { generateId } from "@ifc-viewer/core"
import type { Workspace, WorkspaceRepository } from "@ifc-viewer/core"

export function createWorkspaceRepository(): WorkspaceRepository {
  const store = new Map<string, Workspace>()

  return {
    async create(input: Workspace.CreateInput): Promise<Workspace> {
      const now = new Date()
      const entity: Workspace = {
        id: input.id ?? generateId(),
        projectId: input.projectId,
        status: "active",
        workingDirectory: input.workingDirectory,
        createdAt: now,
        lastAccessedAt: now,
      }
      store.set(entity.id, entity)
      return entity
    },

    async findById(id: string): Promise<Workspace | null> {
      return store.get(id) ?? null
    },

    async findAll(): Promise<Workspace[]> {
      return Array.from(store.values())
    },

    async findByProjectId(projectId: string): Promise<Workspace[]> {
      return Array.from(store.values()).filter((w) => w.projectId === projectId)
    },

    async findActive(): Promise<Workspace[]> {
      return Array.from(store.values()).filter((w) => w.status !== "stopped")
    },

    async update(id: string, input: Workspace.UpdateInput): Promise<Workspace> {
      const existing = store.get(id)
      if (!existing) throw new Error(`Workspace ${id} not found`)

      const updated: Workspace = {
        ...existing,
        status: input.status ?? existing.status,
        lastAccessedAt: input.lastAccessedAt ?? existing.lastAccessedAt,
      }
      store.set(id, updated)
      return updated
    },

    async delete(id: string): Promise<void> {
      store.delete(id)
    },

    async touch(id: string): Promise<Workspace> {
      const existing = store.get(id)
      if (!existing) throw new Error(`Workspace ${id} not found`)

      const updated: Workspace = {
        ...existing,
        lastAccessedAt: new Date(),
      }
      store.set(id, updated)
      return updated
    },
  }
}
