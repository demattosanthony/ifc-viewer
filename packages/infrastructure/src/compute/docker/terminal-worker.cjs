#!/usr/bin/env node
/**
 * Terminal Worker Process
 * 
 * This Node.js script handles Docker's hijack protocol for PTY sessions.
 * It communicates with the parent Bun process via newline-delimited JSON on stdin/stdout.
 * This is needed because of Bun's HTTP protocol limitations.
 * 
 * Protocol:
 * - Parent -> Worker: { type: "init", containerId, options } | { type: "input", data: base64 } | { type: "resize", cols, rows } | { type: "kill" }
 * - Worker -> Parent: { type: "ready" } | { type: "data", data: base64 } | { type: "exit", code } | { type: "error", message }
 */

const Docker = require("dockerode");
const readline = require("readline");

const docker = new Docker();

let stream = null;
let exec = null;
let container = null;

/**
 * Send a message to the parent process
 */
function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

/**
 * Initialize the terminal session
 */
async function initTerminal(containerId, options = {}) {
  try {
    container = docker.getContainer(containerId);
    
    const cwd = options.cwd || "/workspace";
    const env = options.env || {};
    
    // Build environment array
    const envArray = [
      "TERM=xterm-256color",
      "SHELL=/bin/bash",
      "PS1=\\[\\033[36m\\]\\w\\[\\033[0m\\] $ ",
      ...Object.entries(env).map(([k, v]) => `${k}=${v}`),
    ];

    // Support custom command (default to bash for backward compatibility)
    const command = options.command || ["/bin/bash", "-l"];

    // Create exec with TTY
    exec = await container.exec({
      Cmd: command,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Env: envArray,
      WorkingDir: cwd,
    });
    
    // Start with hijack to get bidirectional stream
    stream = await exec.start({
      hijack: true,
      stdin: true,
      Tty: true,
    });
    
    // Handle data from container
    stream.on("data", (chunk) => {
      send({
        type: "data",
        data: chunk.toString("base64"),
      });
    });
    
    stream.on("end", async () => {
      let exitCode = 0;
      try {
        const info = await exec.inspect();
        exitCode = info.ExitCode ?? 0;
      } catch {
        // Ignore inspect errors
      }
      send({ type: "exit", code: exitCode });
      process.exit(0);
    });
    
    stream.on("error", (err) => {
      send({ type: "error", message: err.message });
      process.exit(1);
    });
    
    // Set initial size if provided
    if (options.cols && options.rows) {
      try {
        await exec.resize({ h: options.rows, w: options.cols });
      } catch {
        // Ignore resize errors during init
      }
    }
    
    send({ type: "ready" });
  } catch (err) {
    send({ type: "error", message: err.message });
    process.exit(1);
  }
}

/**
 * Write input to the terminal
 */
function writeInput(base64Data) {
  if (!stream) return;
  
  const buffer = Buffer.from(base64Data, "base64");
  stream.write(buffer);
}

/**
 * Resize the terminal
 */
async function resizeTerminal(cols, rows) {
  if (!exec) return;
  
  try {
    await exec.resize({ h: rows, w: cols });
  } catch (err) {
    // Resize can fail if terminal is not ready, ignore
  }
}

/**
 * Kill the terminal session
 */
async function killTerminal() {
  if (stream) {
    stream.end();
  }
  process.exit(0);
}

// Set up readline for newline-delimited JSON input
const rl = readline.createInterface({
  input: process.stdin,
  output: null,
  terminal: false,
});

rl.on("line", async (line) => {
  try {
    const message = JSON.parse(line);
    
    switch (message.type) {
      case "init":
        await initTerminal(message.containerId, message.options);
        break;
      case "input":
        writeInput(message.data);
        break;
      case "resize":
        await resizeTerminal(message.cols, message.rows);
        break;
      case "kill":
        await killTerminal();
        break;
      default:
        send({ type: "error", message: `Unknown message type: ${message.type}` });
    }
  } catch (err) {
    send({ type: "error", message: `Failed to parse message: ${err.message}` });
  }
});

rl.on("close", () => {
  // Parent closed stdin, clean up
  if (stream) {
    stream.end();
  }
  process.exit(0);
});

// Handle process signals
process.on("SIGTERM", () => {
  if (stream) stream.end();
  process.exit(0);
});

process.on("SIGINT", () => {
  if (stream) stream.end();
  process.exit(0);
});
