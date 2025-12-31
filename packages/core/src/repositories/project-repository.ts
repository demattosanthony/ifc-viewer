import type { Project } from "../entities/project";
import type { CreateProjectInput, UpdateProjectInput } from "./types";

/**
 * Repository interface for Project entity persistence
 */
export interface ProjectRepository {
  /**
   * Create a new project
   */
  create(input: CreateProjectInput): Promise<Project>;

  /**
   * Find a project by ID
   */
  findById(id: string): Promise<Project | null>;

  /**
   * Find a project by name
   */
  findByName(name: string): Promise<Project | null>;

  /**
   * Find all projects
   */
  findAll(): Promise<Project[]>;

  /**
   * Update a project
   */
  update(id: string, input: UpdateProjectInput): Promise<Project>;

  /**
   * Delete a project by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a project exists by ID
   */
  exists(id: string): Promise<boolean>;

  /**
   * Check if a project exists by name
   */
  existsByName(name: string): Promise<boolean>;
}
