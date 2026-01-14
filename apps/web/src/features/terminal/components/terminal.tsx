import { FitAddon } from "@xterm/addon-fit"
import { type ITheme, Terminal as XTerm } from "@xterm/xterm"
import { Loader2, Minus } from "lucide-react"
import { useCallback, useEffect, useRef } from "react"

/**
 * Gets the computed value of a CSS variable.
 */
function getCssVar(varName: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return value || fallback
}

/**
 * Checks if the document has the dark class applied.
 */
function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark")
}

/**
 * Creates an xterm theme from CSS variables.
 */
function getTerminalTheme(): ITheme {
  const dark = isDarkMode()

  const defaults = dark
    ? {
        background: "#1c1b18",
        foreground: "#b5b3a8",
        cursor: "#d4d2c8",
        cursorAccent: "#1c1b18",
        selection: "rgba(212, 210, 200, 0.12)",
        black: "#2e2c26",
        brightBlack: "#5c5a50",
        white: "#c8c6bc",
        brightWhite: "#e8e6dc",
        blue: "#7a9ec4",
        brightBlue: "#9cb8d8",
        cyan: "#6ab0a8",
        brightCyan: "#8cc8c0",
        green: "#8ab87a",
        brightGreen: "#a8d098",
        magenta: "#b898b8",
        brightMagenta: "#d0b8d0",
        red: "#c89090",
        brightRed: "#dca8a8",
        yellow: "#c8b888",
        brightYellow: "#dcd0a0",
      }
    : {
        background: "#f8f7f4",
        foreground: "#4a4637",
        cursor: "#3d3a2e",
        cursorAccent: "#f8f7f4",
        selection: "rgba(74, 70, 55, 0.12)",
        black: "#d4d2c8",
        brightBlack: "#a8a598",
        white: "#4a4637",
        brightWhite: "#2e2c24",
        blue: "#4a6fa5",
        brightBlue: "#3a5a8c",
        cyan: "#3a8a8a",
        brightCyan: "#2d7070",
        green: "#5a8a4a",
        brightGreen: "#4a7340",
        magenta: "#8a5a8a",
        brightMagenta: "#734a73",
        red: "#b35a5a",
        brightRed: "#994a4a",
        yellow: "#9a8a4a",
        brightYellow: "#807340",
      }

  return {
    background: getCssVar("--terminal-background", defaults.background),
    foreground: getCssVar("--terminal-foreground", defaults.foreground),
    cursor: getCssVar("--terminal-cursor", defaults.cursor),
    cursorAccent: getCssVar("--terminal-cursor-accent", defaults.cursorAccent),
    selectionBackground: getCssVar("--terminal-selection", defaults.selection),
    black: getCssVar("--terminal-black", defaults.black),
    brightBlack: getCssVar("--terminal-bright-black", defaults.brightBlack),
    white: getCssVar("--terminal-white", defaults.white),
    brightWhite: getCssVar("--terminal-bright-white", defaults.brightWhite),
    blue: getCssVar("--terminal-blue", defaults.blue),
    brightBlue: getCssVar("--terminal-bright-blue", defaults.brightBlue),
    cyan: getCssVar("--terminal-cyan", defaults.cyan),
    brightCyan: getCssVar("--terminal-bright-cyan", defaults.brightCyan),
    green: getCssVar("--terminal-green", defaults.green),
    brightGreen: getCssVar("--terminal-bright-green", defaults.brightGreen),
    magenta: getCssVar("--terminal-magenta", defaults.magenta),
    brightMagenta: getCssVar("--terminal-bright-magenta", defaults.brightMagenta),
    red: getCssVar("--terminal-red", defaults.red),
    brightRed: getCssVar("--terminal-bright-red", defaults.brightRed),
    yellow: getCssVar("--terminal-yellow", defaults.yellow),
    brightYellow: getCssVar("--terminal-bright-yellow", defaults.brightYellow),
  }
}

interface TerminalMessage {
  type: "ready" | "output" | "exit" | "error"
  data?: string
  message?: string
  terminalId?: string
  code?: number
}

interface TerminalProps {
  projectId: string
  onClose?: () => void
}

type ConnectionState = "connecting" | "connected" | "disconnected" | "error"

export function Terminal({ projectId, onClose }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const connectionStateRef = useRef<ConnectionState>("disconnected")

  const sendResize = useCallback(() => {
    const term = terminalRef.current
    const ws = wsRef.current
    if (!term || !ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }))
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || terminalRef.current) return

    connectionStateRef.current = "connecting"

    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: '"Geist Mono", "Menlo", "Monaco", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.5,
      theme: getTerminalTheme(),
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(container)
    terminalRef.current = terminal

    // Helper to safely fit the terminal
    const safeFit = () => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        try {
          fitAddon.fit()
        } catch {
          // Ignore fit errors during initialization
        }
      }
    }

    // ResizeObserver handles all resize events
    const resizeObserver = new ResizeObserver(() => {
      safeFit()
      sendResize()
    })
    resizeObserver.observe(container)

    // Watch for theme changes
    const themeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          terminal.options.theme = getTerminalTheme()
        }
      }
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    // Initial fit
    requestAnimationFrame(() => {
      safeFit()
    })

    // WebSocket connection
    const wsUrl = `ws://localhost:3000/ws/terminal?projectId=${encodeURIComponent(projectId)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    let isCleaningUp = false
    let wasConnected = false

    ws.onopen = () => {
      wasConnected = true
      terminal.writeln("\x1b[90mConnecting to compute environment...\x1b[0m")
    }

    ws.onmessage = (event) => {
      const message: TerminalMessage = JSON.parse(event.data)
      switch (message.type) {
        case "ready":
          connectionStateRef.current = "connected"
          terminal.writeln("\x1b[32mConnected.\x1b[0m\r\n")
          sendResize()
          break
        case "output":
          if (message.data) {
            terminal.write(message.data)
          }
          break
        case "exit":
          terminal.writeln(`\r\n\x1b[33m[Process exited with code ${message.code}]\x1b[0m`)
          break
        case "error":
          connectionStateRef.current = "error"
          terminal.writeln(`\r\n\x1b[31m[Error: ${message.message}]\x1b[0m`)
          break
      }
    }

    ws.onerror = () => {
      if (!isCleaningUp && wasConnected) {
        connectionStateRef.current = "error"
        terminal.writeln("\r\n\x1b[31m[Connection error]\x1b[0m")
      }
    }

    ws.onclose = (event) => {
      if (!isCleaningUp && wasConnected && !event.wasClean) {
        connectionStateRef.current = "disconnected"
        terminal.writeln("\r\n\x1b[33m[Connection closed]\x1b[0m")
      }
    }

    // Handle user input
    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }))
      }
    })

    return () => {
      isCleaningUp = true
      resizeObserver.disconnect()
      themeObserver.disconnect()
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
      terminal.dispose()
      terminalRef.current = null
      wsRef.current = null
    }
  }, [projectId, sendResize])

  return (
    <div className="terminal-container h-full border-t border-border bg-background overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/50 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          {connectionStateRef.current === "connecting" ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-green-500/80" />
          )}
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
  )
}
