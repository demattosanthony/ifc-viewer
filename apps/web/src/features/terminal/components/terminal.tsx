import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Minus } from "lucide-react";

export interface TerminalHandle {
  typeText: (text: string, speed?: number) => void;
  appendText: (text: string) => void; // For streaming - appends without prefix
  startStreamingCommand: () => void; // Start a new streaming command line
  execute: () => void;
  writeOutput: (data: string) => void;
  focus: () => void;
}

interface TerminalProps {
  sessionId: string;
  onClose?: () => void;
}

interface TerminalMessage {
  type: "ready" | "output" | "exit" | "error";
  data?: string;
  message?: string;
  terminalId?: string;
  code?: number;
}

// Filter out command completion markers from display
const MARKER_REGEX = /<<CMD_DONE:(-?\d+)>>/g;
const ECHO_MARKER_REGEX = /; echo ["']<<CMD_DONE:\$\?>>["']/g;

function filterTerminalOutput(data: string): string {
  // Remove the marker output and the echo command from display
  return data
    .replace(ECHO_MARKER_REGEX, "")  // Remove "; echo '<<CMD_DONE:$?>>'" from command line
    .replace(MARKER_REGEX, "");       // Remove "<<CMD_DONE:0>>" from output
}

const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  { sessionId, onClose },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStreamingRef = useRef<boolean>(false); // Track if we're in streaming mode

  const sendResize = useCallback(() => {
    const term = terminalRef.current;
    const ws = wsRef.current;
    if (!term || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows })
    );
  }, []);

  // Expose methods for AI agent control
  useImperativeHandle(ref, () => ({
    typeText: (text: string, speed = 30) => {
      const term = terminalRef.current;
      if (!term) return;

      // Clear any existing typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Show AI indicator and type directly to display (visual only, no execution)
      term.write("\r\n\x1b[38;5;141m❯ AI: \x1b[0m");
      isStreamingRef.current = false; // Not in streaming mode

      // Type characters one at a time for visual effect
      let index = 0;
      const typeChar = () => {
        if (index < text.length) {
          const char = text[index];
          if (char !== undefined) {
            term.write(char);
          }
          index++;
          typingTimeoutRef.current = setTimeout(typeChar, speed);
        }
      };
      typeChar();
    },
    startStreamingCommand: () => {
      const term = terminalRef.current;
      if (!term) return;

      // Clear any existing typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      // Show AI indicator for streaming command
      term.write("\r\n\x1b[38;5;141m❯ AI: \x1b[0m");
      isStreamingRef.current = true;
    },
    appendText: (text: string) => {
      const term = terminalRef.current;
      if (!term) return;

      // Start streaming if not already
      if (!isStreamingRef.current) {
        term.write("\r\n\x1b[38;5;141m❯ AI: \x1b[0m");
        isStreamingRef.current = true;
      }

      // Write text directly without delay
      term.write(text);
    },
    execute: () => {
      const term = terminalRef.current;
      if (!term) return;
      // Just show a newline - execution happens separately via agent's shell
      term.write("\r\n");
      isStreamingRef.current = false; // End streaming mode
    },
    writeOutput: (data: string) => {
      const term = terminalRef.current;
      if (term) {
        const filtered = filterTerminalOutput(data);
        if (filtered) term.write(filtered);
      }
    },
    focus: () => {
      const term = terminalRef.current;
      if (term) {
        term.focus();
      }
    },
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || terminalRef.current) return;

    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: '"Menlo", "Monaco", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.5,
      theme: {
        background: "#121212",
        foreground: "#a3a3a3",
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
    terminalRef.current = terminal;

    // Helper to safely fit the terminal only when container has dimensions
    const safeFit = () => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        try {
          fitAddon.fit();
        } catch (e) {
          // Ignore fit errors during initialization
        }
      }
    };

    // ResizeObserver handles all resize events (window + container)
    const resizeObserver = new ResizeObserver(() => {
      safeFit();
      sendResize();
    });
    resizeObserver.observe(container);

    // Delay initial fit to ensure container has dimensions
    requestAnimationFrame(() => {
      safeFit();
    });

    // WebSocket connection - connect directly to API server
    const ws = new WebSocket(
      `ws://localhost:3000/ws/terminal?sessionId=${sessionId}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      terminal.writeln("\x1b[90mBIM IDE Terminal\x1b[0m");
    };

    ws.onmessage = (event) => {
      const message: TerminalMessage = JSON.parse(event.data);
      switch (message.type) {
        case "ready":
          sendResize();
          break;
        case "output":
          if (message.data) {
            const filtered = filterTerminalOutput(message.data);
            if (filtered) terminal.write(filtered);
          }
          break;
        case "exit":
          terminal.writeln(`\r\n[Process exited with code ${message.code}]`);
          break;
        case "error":
          console.error("[Terminal] Server error:", message.message);
          terminal.writeln(`\r\n\x1b[31m[Error: ${message.message}]\x1b[0m`);
          break;
      }
    };

    // Track if cleanup has been called (for StrictMode double-mount handling)
    let isCleaningUp = false;
    let wasConnected = false;

    const originalOnOpen = ws.onopen;
    ws.onopen = (event) => {
      wasConnected = true;
      if (originalOnOpen) {
        (originalOnOpen as (ev: Event) => void)(event);
      }
    };

    ws.onerror = () => {
      // Only log errors if we're not cleaning up and were previously connected
      if (!isCleaningUp && wasConnected) {
        console.error("[Terminal] WebSocket error");
        terminal.writeln("\r\n[Connection error]");
      }
    };

    ws.onclose = (event) => {
      // Only show unexpected close message if we're not cleaning up and were connected
      if (!isCleaningUp && wasConnected && !event.wasClean) {
        console.log("[Terminal] WebSocket closed:", event.code, event.reason);
        terminal.writeln("\r\n\x1b[33m[Connection closed unexpectedly]\x1b[0m");
      }
    };

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    return () => {
      isCleaningUp = true;
      resizeObserver.disconnect();
      // Only close if not already closed/closing
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      terminal.dispose();
      terminalRef.current = null;
      wsRef.current = null;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [sessionId, sendResize]);

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
});

export default Terminal;
