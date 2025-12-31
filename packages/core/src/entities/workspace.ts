/**
 * Workspace entity - represents an ephemeral compute environment
 *
 * A Workspace is a short-lived compute environment where a Project is loaded.
 * It replaces the old "Session" concept with clearer semantics.
 *
 * Hierarchy: Project (persistent) -> Workspace (ephemeral) -> Conversation -> Message
 */
export type WorkspaceStatus = "active" | "idle" | "stopped";

export interface Workspace {
  /** Unique identifier */
  readonly id: string;

  /** Reference to the parent Project */
  readonly projectId: string;

  /** Git branch being worked on */
  readonly branch: string;

  /** Current workspace status */
  readonly status: WorkspaceStatus;

  /** When the workspace was created */
  readonly createdAt: Date;

  /** When the workspace was last accessed */
  readonly lastAccessedAt: Date;
}

/**
 * Create a new Workspace entity
 */
export function createWorkspace(params: {
  id: string;
  projectId: string;
  branch?: string;
  status?: WorkspaceStatus;
  createdAt?: Date;
  lastAccessedAt?: Date;
}): Workspace {
  const now = new Date();
  return {
    id: params.id,
    projectId: params.projectId,
    branch: params.branch ?? "main",
    status: params.status ?? "active",
    createdAt: params.createdAt ?? now,
    lastAccessedAt: params.lastAccessedAt ?? now,
  };
}
