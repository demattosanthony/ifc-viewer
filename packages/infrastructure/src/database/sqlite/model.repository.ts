import type { Model, ModelRepository } from "@ifc-viewer/core"
import { generateId, ModelSchema, NotFoundError } from "@ifc-viewer/core"
import { and, desc, eq } from "drizzle-orm"
import type { DrizzleDB, DrizzleTransaction } from "./db"
import { type ModelRow, models } from "./schema"

const rowToEntity = (row: ModelRow): Model =>
  ModelSchema.parse({
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    discipline: row.discipline,
    filePath: row.filePath,
    fileSize: row.fileSize,
    fragmentPath: row.fragmentPath,
    fragmentSize: row.fragmentSize,
    fragmentVersion: row.fragmentVersion,
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
        fragmentPath: input.fragmentPath ?? null,
        fragmentSize: input.fragmentSize ?? null,
        fragmentVersion: input.fragmentVersion ?? null,
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

    async findByFilePath(projectId: string, filePath: string): Promise<Model | null> {
      const [row] = await db
        .select()
        .from(models)
        .where(and(eq(models.projectId, projectId), eq(models.filePath, filePath)))
      return row ? rowToEntity(row) : null
    },

    async update(id: string, input: Model.UpdateInput): Promise<Model> {
      const updates: Partial<ModelRow> = { updatedAt: new Date() }
      if (input.name !== undefined) updates.name = input.name
      if (input.discipline !== undefined) updates.discipline = input.discipline
      if (input.filePath !== undefined) updates.filePath = input.filePath
      if (input.fileSize !== undefined) updates.fileSize = input.fileSize
      if (input.fragmentPath !== undefined) updates.fragmentPath = input.fragmentPath
      if (input.fragmentSize !== undefined) updates.fragmentSize = input.fragmentSize
      if (input.fragmentVersion !== undefined) updates.fragmentVersion = input.fragmentVersion
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
