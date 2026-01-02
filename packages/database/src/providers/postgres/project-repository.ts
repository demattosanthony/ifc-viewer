import { eq } from "drizzle-orm";
import type { Project, Database } from "@ifc-viewer/core";
import { projects, type ProjectRow } from "./schema";
import type { DrizzleDB } from "./db";

const rowToEntity = (row: ProjectRow): Project.Entity => ({
  id: row.id,
  description: row.description,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export function createProjectRepository(db: DrizzleDB): Database.ProjectRepository {
  return {
    async create(input: Project.CreateInput): Promise<Project.Entity> {
      const now = new Date();
      await db.insert(projects).values({
        id: input.id,
        description: input.description ?? null,
        createdAt: now,
        updatedAt: now,
      });
      const [row] = await db.select().from(projects).where(eq(projects.id, input.id));
      return rowToEntity(row);
    },

    async findById(id: string): Promise<Project.Entity | null> {
      const [row] = await db.select().from(projects).where(eq(projects.id, id));
      return row ? rowToEntity(row) : null;
    },

    async findAll(): Promise<Project.Entity[]> {
      const rows = await db.select().from(projects);
      return rows.map(rowToEntity);
    },

    async update(id: string, input: Project.UpdateInput): Promise<Project.Entity> {
      const updates: Partial<ProjectRow> = { updatedAt: new Date() };
      if (input.description !== undefined) updates.description = input.description;
      await db.update(projects).set(updates).where(eq(projects.id, id));
      const [row] = await db.select().from(projects).where(eq(projects.id, id));
      return rowToEntity(row);
    },

    async delete(id: string): Promise<void> {
      await db.delete(projects).where(eq(projects.id, id));
    },
  };
}
