import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  type Project,
  type ProjectRepository,
  type CreateProjectInput,
  type UpdateProjectInput,
  createProject,
} from "@ifc-viewer/core";
import { projects, type ProjectRow } from "./schema";
import type { DrizzleDB } from "./db";

function rowToProject(row: ProjectRow): Project {
  return createProject({
    id: row.id,
    name: row.name,
    description: row.description,
    defaultBranch: row.defaultBranch,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function createSqliteProjectRepository(
  db: DrizzleDB
): ProjectRepository {
  return {
    async create(input: CreateProjectInput): Promise<Project> {
      const now = new Date();
      const id = uuidv4();

      await db.insert(projects).values({
        id,
        name: input.name,
        description: input.description ?? null,
        defaultBranch: input.defaultBranch ?? "main",
        createdAt: now,
        updatedAt: now,
      });

      const [row] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id));

      return rowToProject(row);
    },

    async findById(id: string): Promise<Project | null> {
      const [row] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id));

      return row ? rowToProject(row) : null;
    },

    async findByName(name: string): Promise<Project | null> {
      const [row] = await db
        .select()
        .from(projects)
        .where(eq(projects.name, name));

      return row ? rowToProject(row) : null;
    },

    async findAll(): Promise<Project[]> {
      const rows = await db.select().from(projects);
      return rows.map(rowToProject);
    },

    async update(id: string, input: UpdateProjectInput): Promise<Project> {
      const updates: Partial<ProjectRow> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.defaultBranch !== undefined) updates.defaultBranch = input.defaultBranch;

      await db.update(projects).set(updates).where(eq(projects.id, id));

      const [row] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id));

      return rowToProject(row);
    },

    async delete(id: string): Promise<void> {
      await db.delete(projects).where(eq(projects.id, id));
    },

    async exists(id: string): Promise<boolean> {
      const [row] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, id));

      return !!row;
    },

    async existsByName(name: string): Promise<boolean> {
      const [row] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.name, name));

      return !!row;
    },
  };
}
