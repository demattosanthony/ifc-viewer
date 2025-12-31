import type { Workspace } from "../entities/workspace";
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "./types";

/**
 * Repository interface for Workspace entity persistence
 */
export interface WorkspaceRepository {
  /**
   * Create a new workspace
   */
  create(input: CreateWorkspaceInput): Promise<Workspace>;

  /**
   * Find a workspace by ID
   */
  findById(id: string): Promise<Workspace | null>;

  /**
   * Find all workspaces
   */
  findAll(): Promise<Workspace[]>;

  /**
   * Find all workspaces for a project
   */
  findByProjectId(projectId: string): Promise<Workspace[]>;

  /**
   * Find active workspaces (not stopped)
   */
  findActive(): Promise<Workspace[]>;

  /**
   * Update a workspace
   */
  update(id: string, input: UpdateWorkspaceInput): Promise<Workspace>;

  /**
   * Delete a workspace by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a workspace exists by ID
   */
  exists(id: string): Promise<boolean>;

  /**
   * Touch a workspace (update lastAccessedAt)
   */
  touch(id: string): Promise<Workspace>;
}
