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

/**
 * Path parameter that handles comma-containing filenames.
 * Query parameters with commas may be parsed as arrays by some frameworks.
 * This schema accepts both string and string[] and normalizes to string.
 */
const PathParam = z.union([z.string(), z.array(z.string())])
  .transform((val) => Array.isArray(val) ? val.join(",") : val)

const OptionalPathParam = z.union([z.string(), z.array(z.string())])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined
    return Array.isArray(val) ? val.join(",") : val
  })

/** List files query */
export const ListFilesQuery = z.object({
  path: OptionalPathParam,
})
export type ListFilesQuery = z.infer<typeof ListFilesQuery>

/** Read file query */
export const ReadFileQuery = z.object({
  path: PathParam,
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
  path: PathParam,
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

// ============================================================================
// Upload DTOs
// ============================================================================

/** Request presigned upload URL (S3 optimization) */
export const GetPresignedUrlRequest = z.object({
  /** File path in the project */
  path: z.string(),
  /** MIME type of the file */
  contentType: z.string().optional(),
})
export type GetPresignedUrlRequest = z.infer<typeof GetPresignedUrlRequest>

/** Presigned URL response - only returned when S3 storage is configured */
export const GetPresignedUrlResponse = z.object({
  /** Presigned URL to upload directly to S3 */
  url: z.string(),
  /** HTTP method to use */
  method: z.enum(["PUT", "POST"]),
  /** Headers to include with the upload request */
  headers: z.record(z.string()).optional(),
})
export type GetPresignedUrlResponse = z.infer<typeof GetPresignedUrlResponse>

/** Confirm S3 upload request */
export const ConfirmUploadRequest = z.object({
  /** File path in the project */
  path: z.string(),
})
export type ConfirmUploadRequest = z.infer<typeof ConfirmUploadRequest>
export type ReadFileResponse = z.infer<typeof ReadFileResponse>
