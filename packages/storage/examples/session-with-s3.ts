/**
 * Session Manager with S3 + Ephemeral Compute
 *
 * Real-world example of how to manage user sessions where:
 * - Projects are stored persistently in S3
 * - Each session gets an ephemeral sandbox
 * - Changes are synced back to S3
 */

import type { Computer, TerminalSession } from "@ifc-viewer/computer";
import {
  S3StorageProvider,
  LocalStorageProvider,
  type StorageProvider,
} from "@ifc-viewer/storage";

// =============================================================================
// CONFIGURATION
// =============================================================================

interface Config {
  storage:
    | { type: "s3"; bucket: string; endpoint?: string }
    | { type: "local"; baseDir: string };
  compute:
    | { type: "local" }
    | { type: "e2b"; template?: string };
}

// Development config
const DEV_CONFIG: Config = {
  storage: { type: "local", baseDir: "/tmp/bim-storage" },
  compute: { type: "local" },
};

// Production config
const PROD_CONFIG: Config = {
  storage: {
    type: "s3",
    bucket: "bim-projects",
    endpoint: process.env.S3_ENDPOINT,
  },
  compute: { type: "e2b", template: "bim-workspace" },
};

// =============================================================================
// SESSION TYPES
// =============================================================================

interface Project {
  id: string;
  name: string;
  owner: string;
  createdAt: Date;
}

interface Session {
  id: string;
  project: Project;
  computer: Computer;
  storage: StorageProvider;
  terminals: Map<string, TerminalSession>;
  createdAt: Date;

  // File tracking for change detection
  fileHashes: Map<string, string>;
  dirty: boolean;
}

// =============================================================================
// SESSION MANAGER
// =============================================================================

class ProjectSessionManager {
  private sessions = new Map<string, Session>();
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Create storage provider for a project.
   */
  private createStorage(project: Project): StorageProvider {
    const prefix = `projects/${project.id}`;

    if (this.config.storage.type === "s3") {
      return new S3StorageProvider({
        bucket: this.config.storage.bucket,
        endpoint: this.config.storage.endpoint,
        prefix,
      });
    }

    return new LocalStorageProvider({
      baseDir: `${this.config.storage.baseDir}/${project.id}`,
    });
  }

  /**
   * Create compute sandbox for a session.
   */
  private async createComputer(): Promise<Computer> {
    // Dynamic import to avoid loading unnecessary dependencies
    const { createComputer, local } = await import("@ifc-viewer/computer");

    if (this.config.compute.type === "e2b") {
      // Future: E2B integration
      // const { e2b } = await import("@ifc-viewer/computer/e2b");
      // return createComputer({ provider: e2b({ template: this.config.compute.template }) });
      throw new Error("E2B not yet implemented");
    }

    return createComputer({
      provider: local({ cleanup: true }),
    });
  }

  /**
   * Open a project and create a working session.
   */
  async openProject(project: Project): Promise<Session> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    console.log(`[SessionManager] Opening project: ${project.name}`);

    // Create storage and computer
    const storage = this.createStorage(project);
    const computer = await this.createComputer();

    const session: Session = {
      id: sessionId,
      project,
      computer,
      storage,
      terminals: new Map(),
      createdAt: new Date(),
      fileHashes: new Map(),
      dirty: false,
    };

    // Hydrate sandbox with project files
    await this.hydrateSession(session);

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Hydrate session sandbox with files from storage.
   */
  private async hydrateSession(session: Session): Promise<void> {
    console.log(`[${session.id}] Hydrating from storage...`);

    let fileCount = 0;
    let totalBytes = 0;

    for await (const entry of session.storage.list("")) {
      const obj = await session.storage.get(entry.key);
      if (!obj) continue;

      // Write to sandbox
      await session.computer.files.write(entry.key, obj.data);

      // Track hash for change detection
      const hash = await this.hashData(obj.data);
      session.fileHashes.set(entry.key, hash);

      fileCount++;
      totalBytes += entry.size;
    }

    console.log(`[${session.id}] Loaded ${fileCount} files (${this.formatBytes(totalBytes)})`);
  }

  /**
   * Save a file and mark session as dirty.
   */
  async saveFile(sessionId: string, path: string, content: string | Uint8Array): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    // Write to sandbox
    await session.computer.files.write(path, content);
    session.dirty = true;
  }

  /**
   * Persist all changes from sandbox back to storage.
   */
  async persistChanges(sessionId: string): Promise<string[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    if (!session.dirty) {
      console.log(`[${sessionId}] No changes to persist`);
      return [];
    }

    console.log(`[${sessionId}] Persisting changes to storage...`);

    const changedFiles: string[] = [];
    const allFiles = await this.walkSandbox(session.computer, "/");

    for (const filePath of allFiles) {
      const content = await session.computer.files.read(filePath, { encoding: "binary" });
      if (content.type !== "binary") continue;

      const currentHash = await this.hashData(content.content);
      const previousHash = session.fileHashes.get(filePath);

      if (currentHash !== previousHash) {
        // File changed - upload to storage
        await session.storage.put(filePath, content.content);
        session.fileHashes.set(filePath, currentHash);
        changedFiles.push(filePath);
        console.log(`  ↑ ${filePath}`);
      }
    }

    session.dirty = false;
    console.log(`[${sessionId}] Persisted ${changedFiles.length} files`);

    return changedFiles;
  }

  /**
   * Close a session, optionally persisting changes.
   */
  async closeSession(sessionId: string, options?: { persist?: boolean }): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (options?.persist && session.dirty) {
      await this.persistChanges(sessionId);
    }

    // Kill all terminals
    for (const terminal of session.terminals.values()) {
      await terminal.kill();
    }

    // Dispose compute
    await session.computer.dispose();

    // Dispose storage
    await session.storage.dispose?.();

    this.sessions.delete(sessionId);
    console.log(`[${sessionId}] Session closed`);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async walkSandbox(computer: Computer, path: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await computer.files.list(path);

    for (const entry of entries) {
      if (entry.type === "directory") {
        const subFiles = await this.walkSandbox(computer, entry.path);
        files.push(...subFiles);
      } else {
        files.push(entry.path);
      }
    }

    return files;
  }

  private async hashData(data: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16); // Short hash is fine for change detection
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// =============================================================================
// USAGE EXAMPLE
// =============================================================================

/*

// Create session manager (would be a singleton in your app)
const sessionManager = new ProjectSessionManager(
  process.env.NODE_ENV === "production" ? PROD_CONFIG : DEV_CONFIG
);

// API: Open project
app.post("/api/projects/:id/open", async (req, res) => {
  const project = await db.projects.findById(req.params.id);
  const session = await sessionManager.openProject(project);
  res.json({ sessionId: session.id });
});

// API: Save file
app.post("/api/sessions/:id/files", async (req, res) => {
  const { path, content, encoding } = req.body;
  const data = encoding === "base64"
    ? Buffer.from(content, "base64")
    : content;

  await sessionManager.saveFile(req.params.id, path, data);
  res.json({ success: true });
});

// API: Persist changes
app.post("/api/sessions/:id/persist", async (req, res) => {
  const changed = await sessionManager.persistChanges(req.params.id);
  res.json({ changedFiles: changed });
});

// API: Close session
app.delete("/api/sessions/:id", async (req, res) => {
  await sessionManager.closeSession(req.params.id, { persist: true });
  res.json({ success: true });
});

*/

export { ProjectSessionManager, DEV_CONFIG, PROD_CONFIG };
export type { Config, Project, Session };
