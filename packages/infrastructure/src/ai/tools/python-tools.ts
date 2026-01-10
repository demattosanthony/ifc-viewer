/**
 * Python Tools
 *
 * AI tools for Python code execution in a persistent REPL session.
 * Automatically detects file changes after execution via snapshot diff.
 */

import type { AIEvent, ChangeTracker, TerminalSession } from "@ifc-viewer/core"
import { tool } from "ai"
import { z } from "zod"
import { getErrorMessage, stripAnsi } from "../utils.ts"

// Unique markers to delimit output - using random-ish strings to avoid collision with user output
const OUTPUT_START_MARKER = "<<PY_OUTPUT_START_7x9k>>"
const OUTPUT_END_MARKER = "<<PY_OUTPUT_END_7x9k>>"
const SUCCESS_MARKER = "<<PY_SUCCESS_7x9k>>"
const ERROR_MARKER = "<<PY_ERROR_7x9k>>"

// Regex to extract output between markers
// The markers must be at the START of a line (after \n or \r\n) to avoid matching
// the echoed print("<<marker>>") statements in the Python REPL
const OUTPUT_EXTRACT_REGEX =
  /(?:^|\r?\n)<<PY_OUTPUT_START_7x9k>>\r?\n([\s\S]*?)(?:^|\r?\n)<<PY_OUTPUT_END_7x9k>>/
const RESULT_MARKER_REGEX = /(?:^|\r?\n)<<PY_(SUCCESS|ERROR)_7x9k>>/

export interface PythonToolsOptions {
  getPythonSession: () => Promise<TerminalSession>
  changeTracker: ChangeTracker
  emit: (event: AIEvent) => void
}

export function createPythonTools(options: PythonToolsOptions) {
  const { getPythonSession, changeTracker, emit } = options

  return {
    executePython: tool({
      description: `Execute Python code in a persistent Python REPL session.
Variables, imports, and state persist across calls within the same conversation.
The session has 'import ifcopenshell' pre-loaded.

Use this for:
- IFC file analysis and querying with ifcopenshell
- Data processing and calculations
- Creating reports or extracting data from IFC models

Notes:
- Use print() to display output
- Multi-line code blocks are supported
- Avoid infinite loops or long-running operations
- The working directory is /workspace (same as bash terminal)`,
      inputSchema: z.object({
        title: z
          .string()
          .describe(
            "A short 2-4 word description of what this code does for non-technical users (e.g. 'Query IFC walls', 'Calculate areas', 'List elements')"
          ),
        code: z.string().describe("Python code to execute. Can be single or multi-line."),
        timeout: z.number().default(30000).describe("Timeout in milliseconds (default: 30000)"),
      }),
      execute: async ({
        title: _title,
        code,
        timeout,
      }: {
        title: string
        code: string
        timeout: number
      }) => {
        try {
          emit({ type: "terminal-focus" })
          emit({ type: "terminal-execute" })

          // Snapshot file state before execution
          const beforeSnapshot = await changeTracker.snapshot()

          const session = await getPythonSession()

          let _output = ""
          let success = true
          let cleanup: (() => void) | null = null

          const outputPromise = new Promise<{ output: string; success: boolean }>(
            (resolve, reject) => {
              const timeoutId = setTimeout(() => {
                if (cleanup) {
                  cleanup()
                  cleanup = null
                }
                reject(new Error(`Python execution timed out after ${timeout}ms`))
              }, timeout)

              let buffer = ""

              cleanup = session.onData((data: string) => {
                buffer += data

                // Check for completion (success or error marker)
                const resultMatch = buffer.match(RESULT_MARKER_REGEX)
                if (resultMatch) {
                  success = resultMatch[1] === "SUCCESS"

                  // Extract output between START and END markers
                  const outputMatch = buffer.match(OUTPUT_EXTRACT_REGEX)
                  let cleanOutput = ""
                  if (outputMatch?.[1]) {
                    cleanOutput = outputMatch[1]
                      .replace(/\r\n/g, "\n") // Normalize line endings
                      .replace(/\n+$/, "") // Remove trailing newlines
                      .trim()
                  }

                  clearTimeout(timeoutId)
                  if (cleanup) {
                    cleanup()
                    cleanup = null
                  }

                  _output = cleanOutput
                  if (cleanOutput) {
                    emit({ type: "terminal-output", data: cleanOutput })
                  }
                  resolve({ output: cleanOutput, success })
                }
              })
            }
          )

          // Wrap code in try/except with marker
          const wrappedCode = wrapPythonCode(code)
          // Need TWO newlines: one to end the last line, one blank line to execute the block
          await session.write(`${wrappedCode}\n\n`)

          const result = await outputPromise

          // Detect file changes after execution
          const changes = await changeTracker.detectChanges(beforeSnapshot)
          for (const change of changes) {
            await changeTracker.sync(change)
            if (change.type === "create" || change.type === "update") {
              emit({ type: "file-created", path: change.path })
            } else if (change.type === "delete") {
              emit({ type: "file-deleted", path: change.path })
            }
          }

          return {
            success: result.success,
            output: stripAnsi(result.output),
            filesChanged: changes.length,
          }
        } catch (error) {
          const errorMessage = getErrorMessage(error)
          emit({
            type: "terminal-output",
            data: `\x1b[31mError: ${errorMessage}\x1b[0m\n`,
          })
          return {
            success: false,
            error: errorMessage,
          }
        }
      },
    }),
  }
}

/**
 * Wrap Python code in try/except with output delimiters
 *
 * The wrapper uses exec() to run the code, with markers to delimit the output.
 * The START marker is printed immediately before exec() so that echoed wrapper
 * code doesn't appear between the markers.
 */
function wrapPythonCode(code: string): string {
  const trimmedCode = code.trim()

  // Escape the code for embedding in a triple-quoted string
  const escapedCode = trimmedCode.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')

  // Wrapper structure:
  // 1. try block starts
  // 2. Print START marker (right before exec, so no echoed code between markers)
  // 3. exec() runs user code
  // 4. Print END marker
  // 5. Print SUCCESS marker
  // 6. except block handles errors
  return `try:
    print("${OUTPUT_START_MARKER}")
    exec("""${escapedCode}""", globals())
    print("${OUTPUT_END_MARKER}")
    print("${SUCCESS_MARKER}")
except Exception as __e__:
    print(f"Error: {__e__}")
    print("${OUTPUT_END_MARKER}")
    print("${ERROR_MARKER}")`
}
