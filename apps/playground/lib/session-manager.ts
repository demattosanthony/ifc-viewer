import {
  createComputer,
  local,
  type Computer,
  type TerminalSession,
} from "@ifc-viewer/computer";
import {
  LocalStorageProvider,
  type StorageProvider,
} from "@ifc-viewer/storage";
import { resolve } from "path";

export interface Session {
  id: string;
  computer: Computer;
  storage: StorageProvider;
  terminals: Map<string, TerminalSession>;
  agentTerminal?: TerminalSession;
  timeoutId: ReturnType<typeof setTimeout>;
}

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const SAMPLE_PY_PATH = resolve(import.meta.dir, "../public/print_info.py");
const SAMPLE_IFC_PATH = resolve(import.meta.dir, "../public/sample.ifc");

class SessionManager {
  private sessions = new Map<string, Session>();

  async createSession(): Promise<Session> {
    const sessionId = `session-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 15)}`;

    const workingDirectory = `/tmp/ifc-viewer-playground-0.1`;

    // Create computer for shell and filesystem operations
    const computer = await createComputer({
      provider: local({ cleanup: false }),
      config: { workingDirectory },
    });

    // Create storage provider pointing to the same directory
    // This enables streaming, presigned URLs, and future S3 migration
    const storage = new LocalStorageProvider({
      baseDir: workingDirectory,
      urlMode: "data", // Enable data URLs for local development
    });

    // Load sample files
    const [samplePy, sampleIfc] = await Promise.all([
      Bun.file(SAMPLE_PY_PATH).text(),
      Bun.file(SAMPLE_IFC_PATH).text(),
    ]);

    // Write sample files using storage provider
    await Promise.all([
      storage.put("print_info.py", samplePy),
      storage.put("sample.ifc", sampleIfc),
      storage.put(
        "README.md",
        "Welcome to the IFC Viewer Playground! This is a sample README file."
      ),
      storage.put("folder/file.txt", "This is a sample file in a folder."),
    ]);

    const timeoutId = setTimeout(
      () => this.disposeSession(sessionId),
      SESSION_TIMEOUT_MS
    );

    const session: Session = {
      id: sessionId,
      computer,
      storage,
      terminals: new Map(),
      timeoutId,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  async createTerminal(sessionId: string): Promise<TerminalSession> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const terminal = await session.computer.shell.startTerminal();
    session.terminals.set(terminal.id, terminal);
    return terminal;
  }

  async disposeTerminal(sessionId: string, terminalId: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const terminal = session.terminals.get(terminalId);
    if (!terminal) throw new Error(`Terminal ${terminalId} not found`);

    await terminal.kill();
    session.terminals.delete(terminalId);
  }

  async getAgentTerminal(sessionId: string): Promise<TerminalSession> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    if (!session.agentTerminal) {
      session.agentTerminal = await session.computer.shell.startTerminal();
    }
    return session.agentTerminal;
  }

  async disposeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    clearTimeout(session.timeoutId);

    const terminalsToKill = Array.from(session.terminals.values());
    if (session.agentTerminal) {
      terminalsToKill.push(session.agentTerminal);
    }
    await Promise.all(terminalsToKill.map((t) => t.kill()));

    await session.storage.dispose?.();
    await session.computer.dispose();
    this.sessions.delete(sessionId);
  }

  getSessions(): Session[] {
    return Array.from(this.sessions.values());
  }
}

export const sessionManager = new SessionManager();

process.on("exit", () => {
  for (const session of sessionManager.getSessions()) {
    sessionManager.disposeSession(session.id);
  }
});
