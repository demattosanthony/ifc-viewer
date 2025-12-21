import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Minus } from "lucide-react";

interface TerminalProps {
  sessionId: string;
  onClose?: () => void;
}

interface TerminalMessage {
  type: "ready" | "output" | "exit";
  data?: string;
  terminalId?: string;
  code?: number;
}

export default function Terminal({ sessionId, onClose }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isConnectedRef = useRef(false);

  const sendResize = useCallback(() => {
    const term = terminalRef.current;
    const ws = wsRef.current;
    if (!term || !ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        type: "resize",
        cols: term.cols,
        rows: term.rows,
      })
    );
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || terminalRef.current) return;

    // Initialize xterm with theme matching app
    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: '"Menlo", "Monaco", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.5,
      theme: {
        background: "#121212", // matches --background hsl(0 0% 7%)
        foreground: "#a3a3a3", // muted foreground
        cursor: "#fafafa",
        cursorAccent: "#121212",
        selectionBackground: "rgba(250, 250, 250, 0.15)",
        black: "#262626",
        brightBlack: "#404040",
        white: "#e5e5e5",
        brightWhite: "#fafafa",
        blue: "#60a5fa",
        brightBlue: "#93c5fd",
        cyan: "#22d3ee",
        brightCyan: "#67e8f9",
        green: "#4ade80",
        brightGreen: "#86efac",
        magenta: "#c084fc",
        brightMagenta: "#d8b4fe",
        red: "#f87171",
        brightRed: "#fca5a5",
        yellow: "#facc15",
        brightYellow: "#fde047",
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Connect to WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal?sessionId=${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      isConnectedRef.current = true;
      // Clean welcome message
      terminal.writeln(
        "\x1b[1;36m╔═══════════════════════════════════════╗\x1b[0m"
      );
      terminal.writeln(
        "\x1b[1;36m║   WELCOME TO BIM IDE TERMINAL         ║\x1b[0m"
      );
      terminal.writeln(
        "\x1b[1;36m╚═══════════════════════════════════════╝\x1b[0m"
      );
      terminal.writeln("");
    };

    ws.onmessage = (event) => {
      const message: TerminalMessage = JSON.parse(event.data);

      switch (message.type) {
        case "ready":
          sendResize();
          break;
        case "output":
          if (message.data) {
            terminal.write(message.data);
          }
          break;
        case "exit":
          terminal.writeln(`\r\n[Process exited with code ${message.code}]`);
          break;
      }
    };

    ws.onclose = () => {
      isConnectedRef.current = false;
    };

    ws.onerror = () => {
      terminal.writeln("\r\n[Connection error]");
    };

    // Send input to server
    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddonRef.current?.fit();
      sendResize();
    };

    window.addEventListener("resize", handleResize);

    // Initial resize after a brief delay to ensure proper sizing
    const resizeTimer = setTimeout(handleResize, 100);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
      ws.close();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      wsRef.current = null;
    };
  }, [sessionId, sendResize]);

  // Handle container resize with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
      sendResize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [sendResize]);

  return (
    <div className="terminal-container h-full border-t border-border bg-background overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/50 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500/80" />
          <span className="text-xs text-muted-foreground">Terminal</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close terminal"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
