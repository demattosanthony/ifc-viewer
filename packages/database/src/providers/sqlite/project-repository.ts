import { eq } from "drizzle-orm"
import type { Project, ProjectOps, CreateProjectInput, UpdateProjectInput } from "@ifc-viewer/core"
import { projects, type ProjectRow } from "./schema"
import type { DrizzleDB } from "./db"

const rowToProject = (row: ProjectRow): Project => ({
  id: row.id,
  description: row.description,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export function createSqliteProjectOps(db: DrizzleDB): ProjectOps {
  return {
    async create(input: CreateProjectInput): Promise<Project> {
      const now = new Date()
      await db.insert(projects).values({
        id: input.id,
        description: input.description ?? null,
        createdAt: now,
        updatedAt: now,
      })
      const [row] = await db.select().from(projects).where(eq(projects.id, input.id))
      return rowToProject(row)
    },

    async findById(id: string): Promise<Project | null> {
      const [row] = await db.select().from(projects).where(eq(projects.id, id))
      return row ? rowToProject(row) : null
    },

    async findAll(): Promise<Project[]> {
      const rows = await db.select().from(projects)
      return rows.map(rowToProject)
    },

    async update(id: string, input: UpdateProjectInput): Promise<Project> {
      const updates: Partial<ProjectRow> = { updatedAt: new Date() }
      if (input.description !== undefined) updates.description = input.description
      await db.update(projects).set(updates).where(eq(projects.id, id))
      const [row] = await db.select().from(projects).where(eq(projects.id, id))
      return rowToProject(row)
    },

    async delete(id: string): Promise<void> {
      await db.delete(projects).where(eq(projects.id, id))
    },
  }
}
