import { v4 as uuidv4 } from "uuid";
import {
  type Project,
  type ProjectRepository,
  type CreateProjectInput,
  type UpdateProjectInput,
  createProject,
} from "@ifc-viewer/core";

export function createMemoryProjectRepository(): ProjectRepository {
  const projects = new Map<string, Project>();

  return {
    async create(input: CreateProjectInput): Promise<Project> {
      const project = createProject({
        id: uuidv4(),
        name: input.name,
        description: input.description,
        defaultBranch: input.defaultBranch,
      });
      projects.set(project.id, project);
      return project;
    },

    async findById(id: string): Promise<Project | null> {
      return projects.get(id) ?? null;
    },

    async findByName(name: string): Promise<Project | null> {
      for (const project of projects.values()) {
        if (project.name === name) {
          return project;
        }
      }
      return null;
    },

    async findAll(): Promise<Project[]> {
      return Array.from(projects.values());
    },

    async update(id: string, input: UpdateProjectInput): Promise<Project> {
      const existing = projects.get(id);
      if (!existing) {
        throw new Error(`Project ${id} not found`);
      }
      const updated = createProject({
        ...existing,
        name: input.name ?? existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        defaultBranch: input.defaultBranch ?? existing.defaultBranch,
        updatedAt: new Date(),
      });
      projects.set(id, updated);
      return updated;
    },

    async delete(id: string): Promise<void> {
      projects.delete(id);
    },
  };
}
