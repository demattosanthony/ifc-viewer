import { tool } from "ai";
import { z } from "zod";
import type { TerminalSession } from "@ifc-viewer/computer";
import type { AgentEvent } from "../events";

// Unique marker pattern to detect command completion
const MARKER_PREFIX = "<<CMD_DONE:";
const MARKER_SUFFIX = ">>";
const MARKER_REGEX = /<<CMD_DONE:(-?\d+)>>/;

export function createShellTools(
  getTerminal: () => Promise<TerminalSession>,
  emit: (event: AgentEvent) => void
) {
  // Track active output listener to avoid duplicates
  let outputCleanup: (() => void) | null = null;

  return {
    executeCommand: tool({
      description: `Execute a shell command in the terminal.
Use this for running scripts, installing packages, or any command-line operations.
The command runs in a persistent bash shell in the workspace directory.
IMPORTANT: Avoid interactive commands that require user input - they will hang.
Commands run sequentially and share environment/state between calls.`,
      inputSchema: z.object({
        command: z.string().describe("The command to execute"),
        timeout: z
          .number()
          .default(30000)
          .describe("Timeout in milliseconds (default: 30000)"),
      }),
      execute: async ({
        command,
        timeout,
      }: {
        command: string;
        timeout: number;
      }) => {
        try {
          // Focus the terminal panel (streaming already happened via tool-input-delta)
          emit({ type: "terminal-focus" });

          // Press enter to execute
          emit({ type: "terminal-execute" });

          // Get or create the persistent terminal
          const terminal = await getTerminal();

          // Generate a unique marker for this command
          const marker = `${MARKER_PREFIX}$?${MARKER_SUFFIX}`;

          let output = "";
          let exitCode: number | null = null;
          let skippedEcho = false;

          // Strip ANSI escape codes for pattern matching
          const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "");

          // Pattern to detect the echoed command line (contains our marker echo command)
          const isEchoLine = (line: string) => {
            const clean = stripAnsi(line);
            return (
              clean.includes('echo "<<CMD_DONE:$?>>"') ||
              clean.includes("echo '<<CMD_DONE:$?>>'")
            );
          };

          const outputPromise = new Promise<{
            output: string;
            exitCode: number;
          }>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error(`Command timed out after ${timeout}ms`));
            }, timeout);

            // Clean up any previous listener
            if (outputCleanup) {
              outputCleanup();
              outputCleanup = null;
            }

            // Listen for output
            outputCleanup = terminal.onData((data) => {
              // Filter out echoed command lines containing our marker
              if (!skippedEcho) {
                const lines = data.split("\n");
                const hasEchoLine = lines.some(isEchoLine);
                if (hasEchoLine) {
                  skippedEcho = true;
                  // Keep only lines that don't contain the echo command
                  const filteredLines = lines.filter(
                    (line) => !isEchoLine(line)
                  );
                  const cleanData = filteredLines.join("\n");
                  if (cleanData && cleanData.trim()) {
                    output += cleanData;
                    emit({ type: "terminal-output", data: cleanData });
                  }
                  return;
                }
              }

              // Check for completion marker in output
              const match = data.match(MARKER_REGEX);
              if (match && match[1]) {
                clearTimeout(timeoutId);
                exitCode = parseInt(match[1], 10);

                // Remove marker line from output
                const lines = data.split("\n");
                const cleanLines = lines.filter(
                  (line) => !MARKER_REGEX.test(line)
                );
                const cleanData = cleanLines.join("\n");
                if (cleanData && cleanData.trim()) {
                  output += cleanData;
                  emit({ type: "terminal-output", data: cleanData });
                }

                // Clean up listener
                if (outputCleanup) {
                  outputCleanup();
                  outputCleanup = null;
                }

                resolve({ output: output.trim(), exitCode });
              } else {
                output += data;
                // Stream output to the terminal UI
                emit({ type: "terminal-output", data });
              }
            });
          });

          // Write command followed by marker echo
          // The marker echoes the exit code of the previous command
          await terminal.write(`${command}; echo "${marker}"\n`);

          const result = await outputPromise;

          return {
            success: result.exitCode === 0,
            output: result.output,
            exitCode: result.exitCode,
            command,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          emit({
            type: "terminal-output",
            data: `\x1b[31mError: ${errorMessage}\x1b[0m\n`,
          });
          return {
            success: false,
            error: errorMessage,
            command,
          };
        }
      },
    }),
  };
}
