/**
 * TanStack Query Hooks for IFC Viewer API
 *
 * Auto-generated hooks for React applications using TanStack Query.
 *
 * @example
 * ```tsx
 * import {
 *   postApiSessionsMutation,
 *   getApiSessionsByIdFilesOptions
 * } from '@ifc-viewer/sdk/hooks';
 * import { useQuery, useMutation } from '@tanstack/react-query';
 *
 * function MyComponent({ sessionId }: { sessionId: string }) {
 *   // Create session mutation
 *   const createSession = useMutation(postApiSessionsMutation());
 *
 *   // Query files
 *   const filesQuery = useQuery({
 *     ...getApiSessionsByIdFilesOptions({
 *       path: { id: sessionId },
 *       query: { path: '.' }
 *     }),
 *     enabled: !!sessionId,
 *   });
 * }
 * ```
 */
"use client";

// Import client to ensure it's configured before hooks are used
import "./client";

// Re-export types
export * from "./generated/types.gen";

// Re-export TanStack Query hooks and options
export * from "./generated/@tanstack/react-query.gen";
