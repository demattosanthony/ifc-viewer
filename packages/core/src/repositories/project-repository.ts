import type { Project } from "../entities/project";
import type { CreateProjectInput, UpdateProjectInput } from "./types";

/**
 * Repository interface for Project entity persistence
 */
export interface ProjectRepository {
  create(input: CreateProjectInput): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findAll(): Promise<Project[]>;
  update(id: string, input: UpdateProjectInput): Promise<Project>;
  delete(id: string): Promise<void>;
}
