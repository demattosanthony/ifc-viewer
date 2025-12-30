"use client";

import { useMemo } from "react";
import { createClient, type ApiClient } from "./index";

/**
 * React hook for creating and memoizing the API client
 *
 * @param baseUrl - Optional base URL for the API (defaults to same origin)
 * @returns Memoized API client instance
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const api = useApiClient();
 *
 *   const handleCreateSession = async () => {
 *     const { data, error } = await api.api.sessions.post();
 *     if (data) {
 *       console.log('Created session:', data.id);
 *     }
 *   };
 *
 *   return <button onClick={handleCreateSession}>Create Session</button>;
 * }
 * ```
 */
export function useApiClient(baseUrl?: string): ApiClient {
  return useMemo(() => createClient(baseUrl), [baseUrl]);
}
