import { v4 as uuidv4 } from "uuid"
import type {
  Project,
  ProjectOps,
  CreateProjectInput,
  UpdateProjectInput,
} from "@ifc-viewer/core"

export function createMemoryProjectOps(): ProjectOps {
  const projects = new Map<string, Project>()

  return {
    async create(input: CreateProjectInput): Promise<Project> {
      const now = new Date()
      const project: Project = {
        id: input.id,
        description: input.description ?? null,
        createdAt: now,
        updatedAt: now,
      }
      projects.set(project.id, project)
      return project
    },

    async findById(id: string): Promise<Project | null> {
      return projects.get(id) ?? null
    },

    async findAll(): Promise<Project[]> {
      return Array.from(projects.values())
    },

    async update(id: string, input: UpdateProjectInput): Promise<Project> {
      const existing = projects.get(id)
      if (!existing) throw new Error(`Project ${id} not found`)

      const updated: Project = {
        ...existing,
        description: input.description ?? existing.description,
        updatedAt: new Date(),
      }
      projects.set(id, updated)
      return updated
    },

    async delete(id: string): Promise<void> {
      projects.delete(id)
    },
  }
}
