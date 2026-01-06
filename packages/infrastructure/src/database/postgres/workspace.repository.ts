import { eq, ne } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError } from "@ifc-viewer/core";
import type { Workspace, WorkspaceRepository } from "@ifc-viewer/core";
import { workspaces, type WorkspaceRow } from "./schema";
import type { DrizzleDB, DrizzleTransaction } from "./db";

const rowToEntity = (row: WorkspaceRow): Workspace => ({
  id: row.id,
  projectId: row.projectId,
  status: row.status,
  workingDirectory: row.workingDirectory,
  createdAt: row.createdAt,
  lastAccessedAt: row.lastAccessedAt,
});

export function createWorkspaceRepository(db: DrizzleDB | DrizzleTransaction): WorkspaceRepository {
  return {
    async create(input: Workspace.CreateInput): Promise<Workspace> {
      const now = new Date();
      const id = input.id ?? uuidv4();
      await db.insert(workspaces).values({
        id,
        projectId: input.projectId,
        status: "active",
        workingDirectory: input.workingDirectory,
        createdAt: now,
        lastAccessedAt: now,
      });
      const [row] = await db.select().from(workspaces).where(eq(workspaces.id, id));
      if (!row) throw new NotFoundError("Workspace", id);
      return rowToEntity(row);
    },

    async findById(id: string): Promise<Workspace | null> {
      const [row] = await db.select().from(workspaces).where(eq(workspaces.id, id));
      return row ? rowToEntity(row) : null;
    },

    async findAll(): Promise<Workspace[]> {
      const rows = await db.select().from(workspaces);
      return rows.map(rowToEntity);
    },

    async findByProjectId(projectId: string): Promise<Workspace[]> {
      const rows = await db.select().from(workspaces).where(eq(workspaces.projectId, projectId));
      return rows.map(rowToEntity);
    },

    async findActive(): Promise<Workspace[]> {
      const rows = await db.select().from(workspaces).where(ne(workspaces.status, "stopped"));
      return rows.map(rowToEntity);
    },

    async update(id: string, input: Workspace.UpdateInput): Promise<Workspace> {
      const updates: Partial<WorkspaceRow> = {};
      if (input.status !== undefined) updates.status = input.status;
      if (input.lastAccessedAt !== undefined) updates.lastAccessedAt = input.lastAccessedAt;
      await db.update(workspaces).set(updates).where(eq(workspaces.id, id));
      const [row] = await db.select().from(workspaces).where(eq(workspaces.id, id));
      if (!row) throw new NotFoundError("Workspace", id);
      return rowToEntity(row);
    },

    async delete(id: string): Promise<void> {
      await db.delete(workspaces).where(eq(workspaces.id, id));
    },

    async touch(id: string): Promise<Workspace> {
      const now = new Date();
      await db.update(workspaces).set({ lastAccessedAt: now }).where(eq(workspaces.id, id));
      const [row] = await db.select().from(workspaces).where(eq(workspaces.id, id));
      if (!row) throw new NotFoundError("Workspace", id);
      return rowToEntity(row);
    },
  };
}
