/**
 * Represents a file system entry (file, directory, or symlink)
 */
export interface FileNode {
  /** Name of the file or directory */
  name: string;
  /** Full path relative to working directory */
  path: string;
  /** Type of file system entry */
  type: "file" | "directory" | "symlink";
  /** Size in bytes */
  size: number;
  /** Last modified timestamp */
  modifiedAt: Date;
}

/**
 * File content with type information
 */
export interface FileContent {
  /** Whether content is text or binary */
  type: "text" | "binary";
  /**
   * File content - string for text, base64 encoded for binary
   */
  content: string;
  /** Path to the file */
  path: string;
  /** Size in bytes */
  size: number;
}

/**
 * Detailed file statistics
 */
export interface FileStat {
  /** Type of file system entry */
  type: "file" | "directory" | "symlink";
  /** Size in bytes */
  size: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  modifiedAt: Date;
  /** Last accessed timestamp */
  accessedAt: Date;
}

/**
 * Input for writing file content
 */
export interface WriteFileInput {
  /** Path to write to */
  path: string;
  /** Content to write (string for text, base64 for binary) */
  content: string;
  /** Whether content is base64 encoded binary */
  isBinary?: boolean;
}

/**
 * Input for creating a directory
 */
export interface CreateDirectoryInput {
  /** Path for the new directory */
  path: string;
  /** Create parent directories if they don't exist */
  recursive?: boolean;
}

/**
 * Options for reading file content
 */
export interface ReadFileOptions {
  /** Encoding to use for text files */
  encoding?: "utf-8" | "binary";
}

/**
 * Options for deleting files/directories
 */
export interface DeleteOptions {
  /** Recursively delete directory contents */
  recursive?: boolean;
}
