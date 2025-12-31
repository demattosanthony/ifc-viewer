import { eq, ne } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  type Workspace,
  type WorkspaceRepository,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
  createWorkspace,
} from "@ifc-viewer/core";
import { workspaces, type WorkspaceRow } from "./schema";
import type { DrizzleDB } from "./db";

function rowToWorkspace(row: WorkspaceRow): Workspace {
  return createWorkspace({
    id: row.id,
    projectId: row.projectId,
    branch: row.branch,
    status: row.status,
    createdAt: row.createdAt,
    lastAccessedAt: row.lastAccessedAt,
  });
}

export function createSqliteWorkspaceRepository(
  db: DrizzleDB
): WorkspaceRepository {
  return {
    async create(input: CreateWorkspaceInput): Promise<Workspace> {
      const now = new Date();
      const id = uuidv4();

      await db.insert(workspaces).values({
        id,
        projectId: input.projectId,
        branch: input.branch ?? "main",
        status: "active",
        createdAt: now,
        lastAccessedAt: now,
      });

      const [row] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, id));

      return rowToWorkspace(row);
    },

    async findById(id: string): Promise<Workspace | null> {
      const [row] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, id));

      return row ? rowToWorkspace(row) : null;
    },

    async findAll(): Promise<Workspace[]> {
      const rows = await db.select().from(workspaces);
      return rows.map(rowToWorkspace);
    },

    async findByProjectId(projectId: string): Promise<Workspace[]> {
      const rows = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.projectId, projectId));

      return rows.map(rowToWorkspace);
    },

    async findActive(): Promise<Workspace[]> {
      const rows = await db
        .select()
        .from(workspaces)
        .where(ne(workspaces.status, "stopped"));

      return rows.map(rowToWorkspace);
    },

    async update(id: string, input: UpdateWorkspaceInput): Promise<Workspace> {
      const updates: Partial<WorkspaceRow> = {};

      if (input.status !== undefined) updates.status = input.status;
      if (input.lastAccessedAt !== undefined) updates.lastAccessedAt = input.lastAccessedAt;

      await db.update(workspaces).set(updates).where(eq(workspaces.id, id));

      const [row] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, id));

      return rowToWorkspace(row);
    },

    async delete(id: string): Promise<void> {
      await db.delete(workspaces).where(eq(workspaces.id, id));
    },

    async exists(id: string): Promise<boolean> {
      const [row] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, id));

      return !!row;
    },

    async touch(id: string): Promise<Workspace> {
      const now = new Date();

      await db
        .update(workspaces)
        .set({ lastAccessedAt: now })
        .where(eq(workspaces.id, id));

      const [row] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, id));

      return rowToWorkspace(row);
    },
  };
}
