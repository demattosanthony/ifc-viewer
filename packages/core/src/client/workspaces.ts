import type { Workspace } from "../entities/workspace";
import type { WorkspaceRepository } from "../repositories/workspace-repository";
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "../repositories/types";
import { WorkspaceNotFoundError } from "../errors";
import type { WorkspaceOutput } from "./types";

export interface WorkspacesClient {
  create(input: CreateWorkspaceInput): Promise<WorkspaceOutput>;
  get(id: string): Promise<WorkspaceOutput | null>;
  getOrThrow(id: string): Promise<WorkspaceOutput>;
  list(): Promise<WorkspaceOutput[]>;
  listByProject(projectId: string): Promise<WorkspaceOutput[]>;
  listActive(): Promise<WorkspaceOutput[]>;
  update(id: string, input: UpdateWorkspaceInput): Promise<WorkspaceOutput>;
  touch(id: string): Promise<WorkspaceOutput>;
  delete(id: string): Promise<void>;
}

export interface WorkspacesClientConfig {
  repository: WorkspaceRepository;
}

/**
 * Format a Workspace entity to a WorkspaceOutput DTO
 */
function formatWorkspace(workspace: Workspace): WorkspaceOutput {
  return {
    id: workspace.id,
    projectId: workspace.projectId,
    branch: workspace.branch,
    status: workspace.status,
    createdAt: workspace.createdAt.toISOString(),
    lastAccessedAt: workspace.lastAccessedAt.toISOString(),
  };
}

export function createWorkspacesClient(config: WorkspacesClientConfig): WorkspacesClient {
  const { repository } = config;

  return {
    async create(input) {
      const workspace = await repository.create(input);
      return formatWorkspace(workspace);
    },

    async get(id) {
      const workspace = await repository.findById(id);
      return workspace ? formatWorkspace(workspace) : null;
    },

    async getOrThrow(id) {
      const workspace = await repository.findById(id);
      if (!workspace) throw new WorkspaceNotFoundError(id);
      return formatWorkspace(workspace);
    },

    async list() {
      const workspaces = await repository.findAll();
      return workspaces.map(formatWorkspace);
    },

    async listByProject(projectId) {
      const workspaces = await repository.findByProjectId(projectId);
      return workspaces.map(formatWorkspace);
    },

    async listActive() {
      const workspaces = await repository.findActive();
      return workspaces.map(formatWorkspace);
    },

    async update(id, input) {
      const exists = await repository.exists(id);
      if (!exists) throw new WorkspaceNotFoundError(id);
      const workspace = await repository.update(id, input);
      return formatWorkspace(workspace);
    },

    async touch(id) {
      const exists = await repository.exists(id);
      if (!exists) throw new WorkspaceNotFoundError(id);
      const workspace = await repository.touch(id);
      return formatWorkspace(workspace);
    },

    async delete(id) {
      const exists = await repository.exists(id);
      if (!exists) throw new WorkspaceNotFoundError(id);
      await repository.delete(id);
    },
  };
}
