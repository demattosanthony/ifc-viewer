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

    const computer = await createComputer({
      provider: local({ cleanup: true }),
      config: { workingDirectory: `/tmp/ifc-viewer-playground/${sessionId}` },
    });

    const [samplePy, sampleIfc] = await Promise.all([
      Bun.file(SAMPLE_PY_PATH).text(),
      Bun.file(SAMPLE_IFC_PATH).text(),
    ]);

    await Promise.all([
      computer.files.write("print_info.py", samplePy),
      computer.files.write("sample.ifc", sampleIfc),
      computer.files.write(
        "README.md",
        "Welcome to the IFC Viewer Playground! This is a sample README file."
      ),
      computer.files.write(
        "/folder/file.txt",
        "This is a sample file in a folder."
      ),
    ]);

    const timeoutId = setTimeout(
      () => this.disposeSession(sessionId),
      SESSION_TIMEOUT_MS
    );

    const session: Session = {
      id: sessionId,
      computer,
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

  async disposeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    clearTimeout(session.timeoutId);
    await Promise.all(
      Array.from(session.terminals.values()).map((t) => t.kill())
    );
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
