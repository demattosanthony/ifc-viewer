import type { Model, ModelRepository } from "@ifc-viewer/core"
import { generateId, ModelSchema } from "@ifc-viewer/core"

export function createModelRepository(): ModelRepository {
  const store = new Map<string, Model>()

  return {
    async create(input: Model.CreateInput): Promise<Model> {
      const now = new Date()
      const entity = ModelSchema.parse({
        id: generateId(),
        projectId: input.projectId,
        name: input.name,
        discipline: input.discipline ?? "other",
        filePath: input.filePath,
        fileSize: input.fileSize,
        fragmentPath: input.fragmentPath ?? null,
        fragmentSize: input.fragmentSize ?? null,
        fragmentVersion: input.fragmentVersion ?? null,
        createdAt: now,
        updatedAt: now,
      })
      store.set(entity.id, entity)
      return entity
    },

    async findById(id: string): Promise<Model | null> {
      return store.get(id) ?? null
    },

    async findByProjectId(projectId: string): Promise<Model[]> {
      const results: Model[] = []
      for (const entity of store.values()) {
        if (entity.projectId === projectId) {
          results.push(entity)
        }
      }
      // Sort by createdAt descending (most recent first)
      return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    },

    async findByFilePath(projectId: string, filePath: string): Promise<Model | null> {
      for (const entity of store.values()) {
        if (entity.projectId === projectId && entity.filePath === filePath) {
          return entity
        }
      }
      return null
    },

    async update(id: string, input: Model.UpdateInput): Promise<Model> {
      const existing = store.get(id)
      if (!existing) throw new Error(`Model ${id} not found`)

      const updated = ModelSchema.parse({
        ...existing,
        name: input.name !== undefined ? input.name : existing.name,
        discipline: input.discipline !== undefined ? input.discipline : existing.discipline,
        filePath: input.filePath !== undefined ? input.filePath : existing.filePath,
        fileSize: input.fileSize !== undefined ? input.fileSize : existing.fileSize,
        fragmentPath: input.fragmentPath !== undefined ? input.fragmentPath : existing.fragmentPath,
        fragmentSize: input.fragmentSize !== undefined ? input.fragmentSize : existing.fragmentSize,
        fragmentVersion:
          input.fragmentVersion !== undefined ? input.fragmentVersion : existing.fragmentVersion,
        updatedAt: new Date(),
      })
      store.set(id, updated)
      return updated
    },

    async delete(id: string): Promise<void> {
      store.delete(id)
    },

    async deleteByProjectId(projectId: string): Promise<void> {
      for (const [id, entity] of store) {
        if (entity.projectId === projectId) {
          store.delete(id)
        }
      }
    },
  }
}
