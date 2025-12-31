import { t } from "elysia";

/** Workspace status enum */
export const WorkspaceStatusSchema = t.Union([
  t.Literal("active"),
  t.Literal("idle"),
  t.Literal("stopped"),
]);

/** Workspace entity response - matches @ifc-viewer/core Workspace interface */
export const WorkspaceResponse = t.Object({
  id: t.String(),
  projectId: t.String(),
  status: WorkspaceStatusSchema,
  createdAt: t.Date(),
  lastAccessedAt: t.Date(),
});

/** Array of workspaces */
export const WorkspaceListResponse = t.Array(WorkspaceResponse);
