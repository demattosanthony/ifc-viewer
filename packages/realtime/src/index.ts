/**
 * @ifc-viewer/realtime
 *
 * SSE and WebSocket utilities for the IFC Viewer platform.
 *
 * Server-side utilities:
 * ```ts
 * import { createSSEStream, sseResponse } from '@ifc-viewer/realtime/server';
 * ```
 *
 * Client-side React hooks:
 * ```ts
 * import { useSSE, useWebSocket } from '@ifc-viewer/realtime/client';
 * ```
 *
 * Event types:
 * ```ts
 * import type { AgentEvent, TerminalServerEvent } from '@ifc-viewer/realtime';
 * ```
 */

// Export all events
export * from "./events";

// Re-export server utilities
export * from "./server";

// Re-export client utilities
export * from "./client";
