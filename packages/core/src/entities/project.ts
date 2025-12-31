/**
 * Project entity - represents a persistent git repository for Buildings
 *
 * A Project is the top-level persistent entity that owns:
 * - Git repository metadata
 * - Multiple Workspaces (ephemeral compute environments)
 */
export interface Project {
  /** Unique identifier */
  readonly id: string;

  /** Project name (unique) */
  readonly name: string;

  /** Optional description */
  readonly description: string | null;

  /** Default git branch */
  readonly defaultBranch: string;

  /** When the project was created */
  readonly createdAt: Date;

  /** When the project was last updated */
  readonly updatedAt: Date;
}

/**
 * Create a new Project entity
 */
export function createProject(params: {
  id: string;
  name: string;
  description?: string | null;
  defaultBranch?: string;
  createdAt?: Date;
  updatedAt?: Date;
}): Project {
  const now = new Date();
  return {
    id: params.id,
    name: params.name,
    description: params.description ?? null,
    defaultBranch: params.defaultBranch ?? "main",
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
  };
}
