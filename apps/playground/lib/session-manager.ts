import {
  createComputer,
  local,
  type Computer,
  type TerminalSession,
} from "@ifc-viewer/computer";
import { resolve } from "path";

export interface Session {
  id: string;
  computer: Computer;
  terminals: Map<string, TerminalSession>;
}

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Resolve paths to sample files
const SAMPLE_PY_PATH = resolve(import.meta.dir, "../public/sample.py");
const SAMPLE_IFC_PATH = resolve(import.meta.dir, "../public/sample.ifc");

class SessionManager {
  private sessions = new Map<string, Session>();

  async createSession(): Promise<Session> {
    const sessionId = `session-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 15)}`;

    const computer = await createComputer({
      provider: local({ cleanup: true }),
      config: {
        workingDirectory: `/tmp/ifc-viewer-playground/${sessionId}`,
      },
    });

    // Load sample files from disk
    const [samplePy, sampleIfc] = await Promise.all([
      Bun.file(SAMPLE_PY_PATH).text(),
      Bun.file(SAMPLE_IFC_PATH).text(),
    ]);

    await computer.files.write("sample.py", samplePy);
    await computer.files.write("sample.ifc", sampleIfc);

    const session: Session = {
      id: sessionId,
      computer,
      terminals: new Map(),
    };

    this.sessions.set(sessionId, session);

    // Auto cleanup after timeout
    setTimeout(() => {
      this.disposeSession(sessionId);
    }, SESSION_TIMEOUT_MS);

    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  async createTerminal(sessionId: string): Promise<TerminalSession> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const terminal = await session.computer.shell.startTerminal();
    session.terminals.set(terminal.id, terminal);
    return terminal;
  }

  async disposeTerminal(sessionId: string, terminalId: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const terminal = session.terminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${terminalId} not found`);
    }

    await terminal.kill();
    session.terminals.delete(terminalId);
  }

  disposeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    for (const terminal of session.terminals.values()) {
      terminal.kill();
    }

    session.computer.dispose();
    this.sessions.delete(sessionId);
  }

  getSessions(): Session[] {
    return Array.from(this.sessions.values());
  }
}

export const sessionManager = new SessionManager();

// Cleanup on process exit
process.on("exit", () => {
  for (const session of sessionManager.getSessions()) {
    sessionManager.disposeSession(session.id);
  }
});
