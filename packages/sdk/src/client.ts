/**
 * API Client Configuration
 *
 * This module configures the HTTP client for the SDK.
 * The base URL is configured via the VITE_API_URL environment variable.
 *
 * In development with Vite's proxy, you can leave VITE_API_URL empty
 * to use relative URLs (which will be proxied to the API server).
 */

import { client } from "./generated/client.gen";

/**
 * Get the API base URL from environment variables.
 * - If VITE_API_URL is set, use it
 * - Otherwise use localhost:3000 as fallback
 */
function getBaseUrl(): string {
  // Vite exposes env vars on import.meta.env
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Default to localhost for development
  return "http://localhost:3000";
}

// Configure the client with the base URL
client.setConfig({
  baseUrl: getBaseUrl(),
});

// Re-export the configured client
export { client };

/**
 * Configure the client with a custom base URL.
 * Useful for testing or when the URL needs to be set dynamically.
 */
export function configureClient(baseUrl: string): void {
  client.setConfig({ baseUrl });
}
