/**
 * Files DTOs
 *
 * Request/response schemas for file operations.
 */

import { z } from "zod"

// ============================================================================
// Common Schemas
// ============================================================================

/** File entry type */
export const FileEntryType = z.enum(["file", "directory", "symlink"])
export type FileEntryType = z.infer<typeof FileEntryType>

/** File entry schema */
export const FileEntry = z.object({
  name: z.string(),
  path: z.string(),
  type: FileEntryType,
  size: z.number(),
  modifiedAt: z.number(),
})
export type FileEntry = z.infer<typeof FileEntry>

/** File content type */
export const FileContentType = z.enum(["text", "binary"])
export type FileContentType = z.infer<typeof FileContentType>

// ============================================================================
// Request DTOs
// ============================================================================

/** List files query */
export const ListFilesQuery = z.object({
  path: z.string().optional(),
})
export type ListFilesQuery = z.infer<typeof ListFilesQuery>

/** Read file query */
export const ReadFileQuery = z.object({
  path: z.string(),
})
export type ReadFileQuery = z.infer<typeof ReadFileQuery>

/** Write file request */
export const WriteFileRequest = z.object({
  path: z.string(),
  content: z.string(),
  isBinary: z.boolean().optional(),
})
export type WriteFileRequest = z.infer<typeof WriteFileRequest>

/** Delete file query */
export const DeleteFileQuery = z.object({
  path: z.string(),
})
export type DeleteFileQuery = z.infer<typeof DeleteFileQuery>

/** Create directory request */
export const CreateDirectoryRequest = z.object({
  path: z.string(),
})
export type CreateDirectoryRequest = z.infer<typeof CreateDirectoryRequest>

// ============================================================================
// Response DTOs
// ============================================================================

/** List files response */
export const ListFilesResponse = z.object({
  files: z.array(FileEntry),
  path: z.string(),
})
export type ListFilesResponse = z.infer<typeof ListFilesResponse>

/** Read file response */
export const ReadFileResponse = z.object({
  path: z.string(),
  type: FileContentType,
  content: z.string(),
})
export type ReadFileResponse = z.infer<typeof ReadFileResponse>
