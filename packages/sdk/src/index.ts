/**
 * @ifc-viewer/sdk
 *
 * Type-safe SDK for the IFC Viewer API.
 * Generated from OpenAPI specification using @hey-api/openapi-ts.
 *
 * @example
 * ```ts
 * import { postApiSessions, getApiSessionsByIdFiles } from '@ifc-viewer/sdk';
 *
 * // Create a session
 * const { data, error } = await postApiSessions();
 * if (data) {
 *   console.log('Session ID:', data.id);
 * }
 *
 * // List files
 * const files = await getApiSessionsByIdFiles({
 *   path: { id: sessionId },
 *   query: { path: '.' }
 * });
 * ```
 *
 * For React hooks, import from '@ifc-viewer/sdk/hooks':
 * ```ts
 * import { postApiSessionsMutation, getApiSessionsByIdFilesOptions } from '@ifc-viewer/sdk/hooks';
 * ```
 */

// Export body serializers from @hey-api/client-fetch for custom requests
export { formDataBodySerializer } from "@hey-api/client-fetch"
// Export client configuration (this also configures the base URL)
export { client, configureClient } from "./client"
// Export generated SDK functions
export * from "./generated/sdk.gen"
// Export generated types
export * from "./generated/types.gen"

// SSE client utilities
export { type FetchSSEOptions, fetchSSE } from "./sse"
