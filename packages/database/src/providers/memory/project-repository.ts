import type { Project, Database } from "@ifc-viewer/core"

export function createProjectRepository(): Database.ProjectRepository {
  const store = new Map<string, Project.Entity>()

  return {
    async create(input: Project.CreateInput): Promise<Project.Entity> {
      const now = new Date()
      const entity: Project.Entity = {
        id: input.id,
        description: input.description ?? null,
        createdAt: now,
        updatedAt: now,
      }
      store.set(entity.id, entity)
      return entity
    },

    async findById(id: string): Promise<Project.Entity | null> {
      return store.get(id) ?? null
    },

    async findAll(): Promise<Project.Entity[]> {
      return Array.from(store.values())
    },

    async update(id: string, input: Project.UpdateInput): Promise<Project.Entity> {
      const existing = store.get(id)
      if (!existing) throw new Error(`Project ${id} not found`)

      const updated: Project.Entity = {
        ...existing,
        description: input.description ?? existing.description,
        updatedAt: new Date(),
      }
      store.set(id, updated)
      return updated
    },

    async delete(id: string): Promise<void> {
      store.delete(id)
    },
  }
}
