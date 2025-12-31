import type { Project } from "../entities/project";
import type { ProjectRepository } from "../repositories/project-repository";
import type { CreateProjectInput, UpdateProjectInput } from "../repositories/types";
import { ProjectNotFoundError } from "../errors";
import type { ProjectOutput } from "./types";

export interface ProjectsClient {
  create(input: CreateProjectInput): Promise<ProjectOutput>;
  get(id: string): Promise<ProjectOutput | null>;
  getOrThrow(id: string): Promise<ProjectOutput>;
  getByName(name: string): Promise<ProjectOutput | null>;
  list(): Promise<ProjectOutput[]>;
  update(id: string, input: UpdateProjectInput): Promise<ProjectOutput>;
  delete(id: string): Promise<void>;
}

export interface ProjectsClientConfig {
  repository: ProjectRepository;
}

/**
 * Format a Project entity to a ProjectOutput DTO
 */
function formatProject(project: Project): ProjectOutput {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    defaultBranch: project.defaultBranch,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export function createProjectsClient(config: ProjectsClientConfig): ProjectsClient {
  const { repository } = config;

  return {
    async create(input) {
      const project = await repository.create(input);
      return formatProject(project);
    },

    async get(id) {
      const project = await repository.findById(id);
      return project ? formatProject(project) : null;
    },

    async getOrThrow(id) {
      const project = await repository.findById(id);
      if (!project) throw new ProjectNotFoundError(id);
      return formatProject(project);
    },

    async getByName(name) {
      const project = await repository.findByName(name);
      return project ? formatProject(project) : null;
    },

    async list() {
      const projects = await repository.findAll();
      return projects.map(formatProject);
    },

    async update(id, input) {
      const exists = await repository.exists(id);
      if (!exists) throw new ProjectNotFoundError(id);
      const project = await repository.update(id, input);
      return formatProject(project);
    },

    async delete(id) {
      const exists = await repository.exists(id);
      if (!exists) throw new ProjectNotFoundError(id);
      await repository.delete(id);
    },
  };
}
