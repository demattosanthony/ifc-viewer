/**
 * File Tools
 *
 * AI tools for file system operations.
 * Changes are tracked via ChangeTracker for deferred persistence.
 */

import type { AIEvent, ChangeTracker, Computer } from "@ifc-viewer/core"
import { tool } from "ai"
import { z } from "zod"
import { getErrorMessage } from "../utils"

export interface FileToolsOptions {
  computer: Computer
  changeTracker: ChangeTracker
  emit: (event: AIEvent) => void
}

export function createFileTools(options: FileToolsOptions) {
  const { computer, changeTracker, emit } = options

  return {
    readFile: tool({
      description: "Read the contents of a file at the specified path",
      inputSchema: z.object({
        path: z.string().describe("The path to the file to read"),
      }),
      execute: async ({ path }: { path: string }) => {
        try {
          emit({ type: "editor-open", path })

          const result = await computer.files.read(path)
          if (result.type === "binary") {
            return {
              success: true,
              content: "[Binary file - cannot display as text]",
              type: "binary",
              path,
            }
          }
          return { success: true, content: result.content, type: "text", path }
        } catch (error: unknown) {
          return {
            success: false,
            error: getErrorMessage(error),
            path,
          }
        }
      },
    }),

    writeFile: tool({
      description:
        "Write content to a file at the specified path. Creates the file if it doesn't exist, or overwrites if it does.",
      inputSchema: z.object({
        path: z.string().describe("The path where the file should be written"),
        content: z.string().describe("The content to write to the file"),
      }),
      execute: async ({ path, content }: { path: string; content: string }) => {
        try {
          emit({ type: "editor-open", path })
          emit({ type: "editor-replace", path, content })

          // Check if file exists to determine create vs update
          let exists = false
          try {
            await computer.files.read(path)
            exists = true
          } catch {
            exists = false
          }

          // Write to compute environment
          await computer.files.write(path, content)

          // Sync to storage immediately so file browser can see it
          await changeTracker.sync({
            type: exists ? "update" : "create",
            path,
            source: "tool",
          })

          emit({ type: "editor-save", path })
          emit({ type: "file-created", path })

          return { success: true, path, bytesWritten: content.length }
        } catch (error) {
          emit({ type: "error", message: `Failed to write file: ${path}` })
          return {
            success: false,
            error: getErrorMessage(error),
            path,
          }
        }
      },
    }),
  }
}
