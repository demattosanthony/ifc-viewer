import type { Project, ProjectRepository } from "@ifc-viewer/core"

export function createProjectRepository(): ProjectRepository {
  const store = new Map<string, Project>()

  return {
    async create(input: Project.CreateInput): Promise<Project> {
      const now = new Date()
      const entity: Project = {
        id: input.id,
        description: input.description ?? null,
        createdAt: now,
        updatedAt: now,
      }
      store.set(entity.id, entity)
      return entity
    },

    async findById(id: string): Promise<Project | null> {
      return store.get(id) ?? null
    },

    async findAll(): Promise<Project[]> {
      return Array.from(store.values())
    },

    async update(id: string, input: Project.UpdateInput): Promise<Project> {
      const existing = store.get(id)
      if (!existing) throw new Error(`Project ${id} not found`)

      const updated: Project = {
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
