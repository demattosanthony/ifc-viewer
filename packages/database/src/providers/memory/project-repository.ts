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
        id: input.id,
        description: input.description,
      });
      projects.set(project.id, project);
      return project;
    },

    async findById(id: string): Promise<Project | null> {
      return projects.get(id) ?? null;
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
        description: input.description !== undefined ? input.description : existing.description,
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
