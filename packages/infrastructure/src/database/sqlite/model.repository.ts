import { eq, desc } from "drizzle-orm"
import { NotFoundError, generateId, ModelSchema } from "@ifc-viewer/core"
import type { Model, ModelRepository } from "@ifc-viewer/core"
import { models, type ModelRow } from "./schema"
import type { DrizzleDB, DrizzleTransaction } from "./db"

const rowToEntity = (row: ModelRow): Model =>
  ModelSchema.parse({
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    discipline: row.discipline,
    filePath: row.filePath,
    fileSize: row.fileSize,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })

export function createModelRepository(db: DrizzleDB | DrizzleTransaction): ModelRepository {
  return {
    async create(input: Model.CreateInput): Promise<Model> {
      const now = new Date()
      const id = generateId()
      await db.insert(models).values({
        id,
        projectId: input.projectId,
        name: input.name,
        discipline: input.discipline ?? "other",
        filePath: input.filePath,
        fileSize: input.fileSize,
        createdAt: now,
        updatedAt: now,
      })
      const [row] = await db.select().from(models).where(eq(models.id, id))
      if (!row) throw new NotFoundError("Model", id)
      return rowToEntity(row)
    },

    async findById(id: string): Promise<Model | null> {
      const [row] = await db.select().from(models).where(eq(models.id, id))
      return row ? rowToEntity(row) : null
    },

    async findByProjectId(projectId: string): Promise<Model[]> {
      const rows = await db
        .select()
        .from(models)
        .where(eq(models.projectId, projectId))
        .orderBy(desc(models.createdAt))
      return rows.map(rowToEntity)
    },

    async update(id: string, input: Model.UpdateInput): Promise<Model> {
      const updates: Partial<ModelRow> = { updatedAt: new Date() }
      if (input.name !== undefined) updates.name = input.name
      if (input.discipline !== undefined) updates.discipline = input.discipline
      await db.update(models).set(updates).where(eq(models.id, id))
      const [row] = await db.select().from(models).where(eq(models.id, id))
      if (!row) throw new NotFoundError("Model", id)
      return rowToEntity(row)
    },

    async delete(id: string): Promise<void> {
      await db.delete(models).where(eq(models.id, id))
    },

    async deleteByProjectId(projectId: string): Promise<void> {
      await db.delete(models).where(eq(models.projectId, projectId))
    },
  }
}
