/**
 * API client wrapper using the @ifc-viewer/sdk package.
 * Provides a simple interface that extracts data and throws on errors.
 */

import { createClient } from "@ifc-viewer/sdk";

// Connect directly to API server (CORS is enabled on the API)
const client = createClient("http://localhost:3000");

/**
 * Helper to unwrap SDK responses that return { data, error }
 */
async function unwrap<T>(
  promise: Promise<{ data: T | null; error: unknown }>
): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "value" in error
        ? JSON.stringify((error as { value: unknown }).value)
        : String(error);
    throw new Error(message);
  }
  if (data === null) {
    throw new Error("No data returned");
  }
  return data;
}

export const api = {
  sessions: {
    /**
     * Create a new session
     */
    async createSession() {
      return unwrap(client.api.sessions.post());
    },

    /**
     * Get all sessions
     */
    async getSessions() {
      return unwrap(client.api.sessions.get());
    },

    /**
     * Get a specific session
     */
    async getSession(opts: { id: string }) {
      return unwrap(client.api.sessions({ id: opts.id }).get());
    },

    /**
     * Dispose a session
     */
    async disposeSession(opts: { id: string }) {
      return unwrap(client.api.sessions({ id: opts.id }).delete());
    },

    files: {
      /**
       * List files in a directory
       */
      async listFiles(opts: { id: string; path?: string }) {
        return unwrap(
          client.api.sessions({ id: opts.id }).files.get({
            query: { path: opts.path ?? "." },
          })
        );
      },

      /**
       * Create a directory
       */
      async createDirectory(opts: { id: string; path: string }) {
        return unwrap(
          client.api.sessions({ id: opts.id }).files.directory.post({
            path: opts.path,
          })
        );
      },

      /**
       * Delete a file or directory
       */
      async deleteFile(opts: { id: string; path: string }) {
        return unwrap(
          client.api
            .sessions({ id: opts.id })
            .files.delete({}, { query: { path: opts.path } })
        );
      },

      content: {
        /**
         * Read file content
         */
        async readFile(opts: { id: string; path: string }) {
          return unwrap(
            client.api.sessions({ id: opts.id }).files.content.get({
              query: { path: opts.path },
            })
          );
        },

        /**
         * Write file content
         */
        async writeFile(opts: { id: string; path: string; content: string }) {
          return unwrap(
            client.api.sessions({ id: opts.id }).files.content.post({
              path: opts.path,
              content: opts.content,
            })
          );
        },
      },
    },
  },
};
