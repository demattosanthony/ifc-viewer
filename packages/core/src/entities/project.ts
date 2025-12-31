/**
 * Project entity - represents a persistent project with files stored in storage
 *
 * A Project is the top-level persistent entity that owns:
 * - Files in storage (IFC models, scripts, etc.)
 * - Multiple Workspaces (ephemeral compute environments)
 *
 * The project ID is a URL-friendly slug (like GitHub repo names):
 * - Lowercase letters, numbers, and hyphens
 * - Must start with a letter or number
 * - 1-100 characters
 * - Examples: "sample-project", "my-building-2024"
 */
export interface Project {
  /** URL-friendly slug identifier (e.g., "sample-project") */
  readonly id: string;

  /** Optional description */
  readonly description: string | null;

  /** When the project was created */
  readonly createdAt: Date;

  /** When the project was last updated */
  readonly updatedAt: Date;
}

/**
 * Validate a project slug (GitHub-style naming rules)
 * - Lowercase letters, numbers, and hyphens only
 * - Must start with a letter or number
 * - Cannot end with a hyphen
 * - Cannot have consecutive hyphens
 * - 1-100 characters
 */
export function isValidProjectSlug(slug: string): boolean {
  if (slug.length < 1 || slug.length > 100) return false;
  // GitHub-style: lowercase alphanumeric, hyphens, must start/end with alphanumeric
  const pattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  if (!pattern.test(slug)) return false;
  // No consecutive hyphens
  if (slug.includes("--")) return false;
  return true;
}

/**
 * Create a new Project entity
 */
export function createProject(params: {
  id: string;
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}): Project {
  const now = new Date();
  return {
    id: params.id,
    description: params.description ?? null,
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
  };
}
