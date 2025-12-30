/**
 * @ifc-viewer/sdk
 *
 * Type-safe SDK for the IFC Viewer API using Eden treaty.
 * Auto-generated types from Elysia server ensure full type safety.
 *
 * @example
 * ```ts
 * import { createClient } from '@ifc-viewer/sdk';
 *
 * const api = createClient('http://localhost:3000');
 *
 * // Create a session
 * const { data, error } = await api.api.sessions.post();
 * if (data) {
 *   console.log('Session ID:', data.id);
 * }
 *
 * // List files
 * const files = await api.api.sessions[sessionId].files.get({
 *   query: { path: '.' }
 * });
 * ```
 */

import { treaty } from "@elysiajs/eden";
import type { App } from "@ifc-viewer/api";

// Re-export the App type for consumers who need it
export type { App };

/**
 * Create a type-safe API client for the IFC Viewer API
 *
 * @param baseUrl - Base URL of the API server (e.g., 'http://localhost:3000')
 * @returns Type-safe API client with full IntelliSense support
 *
 * @example
 * ```ts
 * const api = createClient('http://localhost:3000');
 *
 * // All endpoints are fully typed!
 * const session = await api.api.sessions.post();
 * ```
 */
export function createClient(baseUrl: string = "") {
  return treaty<App>(baseUrl);
}

/**
 * Type of the API client returned by createClient
 */
export type ApiClient = ReturnType<typeof createClient>;

// Re-export hooks for React users
export * from "./hooks";
