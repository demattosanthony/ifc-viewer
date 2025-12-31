import { v4 as uuidv4 } from "uuid";
import {
  type Workspace,
  type WorkspaceRepository,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
  createWorkspace,
} from "@ifc-viewer/core";

export function createMemoryWorkspaceRepository(): WorkspaceRepository {
  const workspaces = new Map<string, Workspace>();

  return {
    async create(input: CreateWorkspaceInput): Promise<Workspace> {
      const workspace = createWorkspace({
        id: uuidv4(),
        projectId: input.projectId,
      });
      workspaces.set(workspace.id, workspace);
      return workspace;
    },

    async findById(id: string): Promise<Workspace | null> {
      return workspaces.get(id) ?? null;
    },

    async findAll(): Promise<Workspace[]> {
      return Array.from(workspaces.values());
    },

    async findByProjectId(projectId: string): Promise<Workspace[]> {
      return Array.from(workspaces.values()).filter(
        (w) => w.projectId === projectId
      );
    },

    async findActive(): Promise<Workspace[]> {
      return Array.from(workspaces.values()).filter(
        (w) => w.status !== "stopped"
      );
    },

    async update(id: string, input: UpdateWorkspaceInput): Promise<Workspace> {
      const existing = workspaces.get(id);
      if (!existing) {
        throw new Error(`Workspace ${id} not found`);
      }
      const updated = createWorkspace({
        ...existing,
        status: input.status ?? existing.status,
        lastAccessedAt: input.lastAccessedAt ?? existing.lastAccessedAt,
      });
      workspaces.set(id, updated);
      return updated;
    },

    async delete(id: string): Promise<void> {
      workspaces.delete(id);
    },

    async touch(id: string): Promise<Workspace> {
      const existing = workspaces.get(id);
      if (!existing) {
        throw new Error(`Workspace ${id} not found`);
      }
      const updated = createWorkspace({
        ...existing,
        lastAccessedAt: new Date(),
      });
      workspaces.set(id, updated);
      return updated;
    },
  };
}
