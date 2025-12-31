import { t } from "elysia";

/** Project entity response - matches @ifc-viewer/core Project interface */
export const ProjectResponse = t.Object({
  id: t.String(),
  description: t.Union([t.String(), t.Null()]),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

/** Array of projects */
export const ProjectListResponse = t.Array(ProjectResponse);
