import { t } from "elysia";

/** Single file entry - matches @ifc-viewer/compute FileEntry */
export const FileEntrySchema = t.Object({
  name: t.String(),
  path: t.String(),
  type: t.Union([t.Literal("file"), t.Literal("directory"), t.Literal("symlink")]),
  size: t.Number(),
  modifiedAt: t.Number(),
});

/** File listing response */
export const FileListResponse = t.Object({
  files: t.Array(FileEntrySchema),
  path: t.String(),
});

/** File content response */
export const FileContentResponse = t.Object({
  path: t.String(),
  type: t.Union([t.Literal("text"), t.Literal("binary")]),
  content: t.String(),
});
