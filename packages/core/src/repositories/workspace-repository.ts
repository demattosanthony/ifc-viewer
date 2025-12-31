import type { Workspace } from "../entities/workspace";
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "./types";

/**
 * Repository interface for Workspace entity persistence
 */
export interface WorkspaceRepository {
  create(input: CreateWorkspaceInput): Promise<Workspace>;
  findById(id: string): Promise<Workspace | null>;
  findAll(): Promise<Workspace[]>;
  findByProjectId(projectId: string): Promise<Workspace[]>;
  findActive(): Promise<Workspace[]>;
  update(id: string, input: UpdateWorkspaceInput): Promise<Workspace>;
  delete(id: string): Promise<void>;
  touch(id: string): Promise<Workspace>;
}
