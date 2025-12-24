/**
 * Ephemeral Compute + Persistent Storage Pattern
 *
 * This example shows how to:
 * 1. Spin up an ephemeral sandbox (E2B, Docker, etc.)
 * 2. Hydrate it with data from persistent storage (S3)
 * 3. Work in the sandbox
 * 4. Persist changes back to storage
 */

import type { Computer } from "@ifc-viewer/computer";
import type { StorageProvider } from "@ifc-viewer/storage";
import { S3StorageProvider } from "@ifc-viewer/storage";
// import { E2BComputer } from "@ifc-viewer/computer/e2b"; // Future

// =============================================================================
// CORE TYPES
// =============================================================================

export interface Project {
  id: string;
  name: string;
  /** Storage prefix for this project's files */
  storagePrefix: string;
}

export interface Workspace {
  id: string;
  project: Project;
  computer: Computer;
  storage: StorageProvider;

  /** Sync files from storage into the sandbox */
  hydrate(): Promise<void>;

  /** Sync changed files from sandbox back to storage */
  persist(): Promise<void>;

  /** Clean up the workspace */
  dispose(): Promise<void>;
}

// =============================================================================
// WORKSPACE IMPLEMENTATION
// =============================================================================

export interface CreateWorkspaceOptions {
  project: Project;
  storage: StorageProvider;
  computer: Computer;
}

export async function createWorkspace(
  options: CreateWorkspaceOptions
): Promise<Workspace> {
  const { project, storage, computer } = options;
  const workspaceId = `workspace-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Track which files exist and their checksums for change detection
  const fileChecksums = new Map<string, string>();

  const workspace: Workspace = {
    id: workspaceId,
    project,
    computer,
    storage,

    async hydrate() {
      console.log(`[${workspaceId}] Hydrating sandbox from storage...`);

      // List all files in the project's storage prefix
      const prefix = project.storagePrefix;

      for await (const entry of storage.list(prefix)) {
        // Get the relative path (strip prefix)
        const relativePath = entry.key.slice(prefix.length).replace(/^\//, "");
        if (!relativePath) continue;

        // Fetch file from storage
        const obj = await storage.get(entry.key);
        if (!obj) continue;

        // Write to sandbox filesystem
        await computer.files.write(relativePath, obj.data);

        // Track checksum for change detection
        fileChecksums.set(relativePath, await computeChecksum(obj.data));

        console.log(`  ✓ ${relativePath} (${formatBytes(entry.size)})`);
      }

      console.log(`[${workspaceId}] Hydration complete`);
    },

    async persist() {
      console.log(`[${workspaceId}] Persisting changes to storage...`);

      // Walk the sandbox filesystem and find changed files
      const changedFiles: string[] = [];
      const allFiles = await walkDirectory(computer, "/");

      for (const filePath of allFiles) {
        const content = await computer.files.read(filePath, { encoding: "binary" });
        if (content.type !== "binary") continue;

        const currentChecksum = await computeChecksum(content.content);
        const previousChecksum = fileChecksums.get(filePath);

        if (currentChecksum !== previousChecksum) {
          changedFiles.push(filePath);

          // Upload to storage
          const storageKey = `${project.storagePrefix}/${filePath}`.replace(/\/+/g, "/");
          await storage.put(storageKey, content.content);

          // Update tracked checksum
          fileChecksums.set(filePath, currentChecksum);

          console.log(`  ↑ ${filePath}`);
        }
      }

      if (changedFiles.length === 0) {
        console.log(`  (no changes)`);
      }

      console.log(`[${workspaceId}] Persist complete`);
    },

    async dispose() {
      console.log(`[${workspaceId}] Disposing workspace...`);
      await computer.dispose();
    },
  };

  return workspace;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function walkDirectory(computer: Computer, path: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await computer.files.list(path);

  for (const entry of entries) {
    if (entry.type === "directory") {
      const subFiles = await walkDirectory(computer, entry.path);
      files.push(...subFiles);
    } else if (entry.type === "file") {
      files.push(entry.path);
    }
  }

  return files;
}

async function computeChecksum(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// USAGE EXAMPLE
// =============================================================================

/*
import { S3StorageProvider } from "@ifc-viewer/storage";
import { createComputer, local } from "@ifc-viewer/computer";
// import { e2b } from "@ifc-viewer/computer/e2b"; // Future

async function main() {
  // 1. Create storage provider (persistent)
  const storage = new S3StorageProvider({
    bucket: "bim-projects",
    prefix: "projects",
  });

  // 2. Create computer (ephemeral sandbox)
  const computer = await createComputer({
    provider: local({ cleanup: true }), // or e2b() for cloud sandbox
  });

  // 3. Create workspace linking them together
  const workspace = await createWorkspace({
    project: {
      id: "proj-123",
      name: "Office Building",
      storagePrefix: "projects/proj-123/",
    },
    storage,
    computer,
  });

  try {
    // 4. Hydrate sandbox with project files from S3
    await workspace.hydrate();

    // 5. Do work in the sandbox...
    // - User edits files via terminal
    // - Scripts process IFC files
    // - etc.

    // 6. Persist changes back to S3
    await workspace.persist();

  } finally {
    // 7. Clean up
    await workspace.dispose();
  }
}
*/
