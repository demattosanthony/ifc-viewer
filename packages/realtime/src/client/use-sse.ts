"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Options for the useSSE hook
 */
export interface UseSSEOptions<T> {
  /** SSE endpoint URL */
  url: string;
  /** Callback when an event is received */
  onEvent: (event: T) => void;
  /** Callback when an error occurs */
  onError?: (error: Event) => void;
  /** Callback when connection opens */
  onOpen?: () => void;
  /** Callback when connection closes */
  onClose?: () => void;
  /** Whether the connection is enabled */
  enabled?: boolean;
  /** Event name to listen for (defaults to 'message') */
  eventName?: string;
}

/**
 * Return type for the useSSE hook
 */
export interface UseSSEReturn {
  /** Whether the connection is currently open */
  isConnected: boolean;
  /** Close the connection manually */
  close: () => void;
  /** Reconnect after closing */
  reconnect: () => void;
}

/**
 * React hook for Server-Sent Events (SSE) connections
 *
 * @example
 * ```tsx
 * function AgentChat({ sessionId }: { sessionId: string }) {
 *   const { isConnected } = useSSE<AgentEvent>({
 *     url: `/api/sessions/${sessionId}/agent/chat`,
 *     onEvent: (event) => {
 *       console.log('Received:', event);
 *     },
 *     enabled: !!sessionId,
 *   });
 *
 *   return <div>Connected: {isConnected ? 'Yes' : 'No'}</div>;
 * }
 * ```
 */
export function useSSE<T>(options: UseSSEOptions<T>): UseSSEReturn {
  const { url, onEvent, onError, onOpen, onClose, enabled = true, eventName } = options;

  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef(false);

  // Store callbacks in refs to avoid recreating effect
  const callbacksRef = useRef({ onEvent, onError, onOpen, onClose });
  callbacksRef.current = { onEvent, onError, onOpen, onClose };

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      callbacksRef.current.onOpen?.();
    };

    eventSource.onerror = (error) => {
      setIsConnected(false);
      callbacksRef.current.onError?.(error);
    };

    // Listen for the specified event name or use generic message handler
    if (eventName) {
      eventSource.addEventListener(eventName, (event) => {
        try {
          const data = JSON.parse(event.data) as T;
          callbacksRef.current.onEvent(data);
        } catch (error) {
          console.error("[SSE] Failed to parse event data:", error);
        }
      });
    } else {
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as T;
          callbacksRef.current.onEvent(data);
        } catch (error) {
          console.error("[SSE] Failed to parse event data:", error);
        }
      };
    }
  }, [url, eventName]);

  const close = useCallback(() => {
    reconnectRef.current = false;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      callbacksRef.current.onClose?.();
    }
  }, []);

  const reconnect = useCallback(() => {
    reconnectRef.current = true;
    close();
    if (enabled) {
      connect();
    }
  }, [connect, close, enabled]);

  useEffect(() => {
    if (!enabled) {
      close();
      return;
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [enabled, connect, close]);

  return {
    isConnected,
    close,
    reconnect,
  };
}
