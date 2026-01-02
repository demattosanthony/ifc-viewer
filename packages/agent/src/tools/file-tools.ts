import { tool } from "ai"
import { z } from "zod"
import type { Computer } from "@ifc-viewer/core"
import type { AgentEvent } from "../events"
import { getErrorMessage } from "../utils"

export function createFileTools(
  computer: Computer,
  emit: (event: AgentEvent) => void
) {
  return {
    readFile: tool({
      description: "Read the contents of a file at the specified path",
      inputSchema: z.object({
        path: z.string().describe("The path to the file to read"),
      }),
      execute: async ({ path }: { path: string }) => {
        try {
          emit({ type: "editor-open", path });

          const result = await computer.files.read(path);
          if (result.type === "binary") {
            return {
              success: true,
              content: "[Binary file - cannot display as text]",
              type: "binary",
              path,
            };
          }
          return { success: true, content: result.content, type: "text", path };
        } catch (error: unknown) {
          return {
            success: false,
            error: getErrorMessage(error),
            path,
          };
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
          emit({ type: "editor-open", path });
          emit({ type: "editor-replace", path, content });
          await computer.files.write(path, content);
          emit({ type: "editor-save", path });
          emit({ type: "file-created", path });

          return { success: true, path, bytesWritten: content.length };
        } catch (error) {
          emit({ type: "error", message: `Failed to write file: ${path}` });
          return {
            success: false,
            error: getErrorMessage(error),
            path,
          };
        }
      },
    }),

    listFiles: tool({
      description: "List files and directories at the specified path",
      inputSchema: z.object({
        path: z
          .string()
          .default(".")
          .describe(
            "The directory path to list (defaults to current directory)"
          ),
      }),
      execute: async ({ path }: { path: string }) => {
        try {
          const entries = await computer.files.list(path);
          return {
            success: true,
            path,
            entries: entries.map((e) => ({
              name: e.name,
              path: e.path,
              type: e.type,
              size: e.size,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: getErrorMessage(error),
            path,
          };
        }
      },
    }),

    createDirectory: tool({
      description: "Create a new directory at the specified path",
      inputSchema: z.object({
        path: z
          .string()
          .describe("The path where the directory should be created"),
      }),
      execute: async ({ path }: { path: string }) => {
        try {
          await computer.files.mkdir(path, { recursive: true });
          emit({ type: "file-created", path });
          return { success: true, path };
        } catch (error) {
          return {
            success: false,
            error: getErrorMessage(error),
            path,
          };
        }
      },
    }),

    deleteFile: tool({
      description:
        "Delete a file or directory at the specified path. Use with caution.",
      inputSchema: z.object({
        path: z.string().describe("The path to delete"),
        recursive: z
          .boolean()
          .default(false)
          .describe("Whether to recursively delete directories"),
      }),
      execute: async ({
        path,
        recursive,
      }: {
        path: string;
        recursive: boolean;
      }) => {
        try {
          await computer.files.delete(path, { recursive });
          emit({ type: "file-deleted", path });
          return { success: true, path };
        } catch (error) {
          return {
            success: false,
            error: getErrorMessage(error),
            path,
          };
        }
      },
    }),

    moveFile: tool({
      description: "Move or rename a file or directory",
      inputSchema: z.object({
        source: z.string().describe("The current path of the file/directory"),
        destination: z.string().describe("The new path"),
      }),
      execute: async ({
        source,
        destination,
      }: {
        source: string;
        destination: string;
      }) => {
        try {
          await computer.files.move(source, destination);
          emit({ type: "file-deleted", path: source });
          emit({ type: "file-created", path: destination });
          return { success: true, source, destination };
        } catch (error) {
          return {
            success: false,
            error: getErrorMessage(error),
            source,
            destination,
          };
        }
      },
    }),
  };
}
