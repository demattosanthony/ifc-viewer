"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Options for the useWebSocket hook
 */
export interface UseWebSocketOptions<TReceive, TSend = TReceive> {
  /** WebSocket endpoint URL */
  url: string;
  /** Callback when a message is received */
  onMessage: (data: TReceive) => void;
  /** Callback when connection opens */
  onOpen?: () => void;
  /** Callback when connection closes */
  onClose?: (event: CloseEvent) => void;
  /** Callback when an error occurs */
  onError?: (error: Event) => void;
  /** Whether the connection is enabled */
  enabled?: boolean;
  /** Whether to automatically reconnect on disconnect */
  reconnect?: boolean;
  /** Base delay for reconnection in milliseconds */
  reconnectDelay?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
}

/**
 * Return type for the useWebSocket hook
 */
export interface UseWebSocketReturn<TSend> {
  /** Whether the connection is currently open */
  isConnected: boolean;
  /** Send a message through the WebSocket */
  send: (data: TSend) => void;
  /** Close the connection manually */
  close: () => void;
  /** Reconnect after closing */
  reconnect: () => void;
}

/**
 * React hook for WebSocket connections with automatic reconnection
 *
 * @example
 * ```tsx
 * function Terminal({ sessionId }: { sessionId: string }) {
 *   const { isConnected, send } = useWebSocket<TerminalServerEvent, TerminalClientMessage>({
 *     url: `ws://localhost:3000/ws/terminal?sessionId=${sessionId}`,
 *     onMessage: (event) => {
 *       if (event.type === 'output') {
 *         terminal.write(event.data);
 *       }
 *     },
 *     enabled: !!sessionId,
 *     reconnect: true,
 *   });
 *
 *   const handleInput = (data: string) => {
 *     send({ type: 'input', data });
 *   };
 *
 *   return <TerminalComponent onInput={handleInput} />;
 * }
 * ```
 */
export function useWebSocket<TReceive, TSend = TReceive>(
  options: UseWebSocketOptions<TReceive, TSend>
): UseWebSocketReturn<TSend> {
  const {
    url,
    onMessage,
    onOpen,
    onClose,
    onError,
    enabled = true,
    reconnect: shouldReconnect = false,
    reconnectDelay = 1000,
    maxReconnectAttempts = 10,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(shouldReconnect);
  shouldReconnectRef.current = shouldReconnect;

  // Store callbacks in refs to avoid recreating effect
  const callbacksRef = useRef({ onMessage, onOpen, onClose, onError });
  callbacksRef.current = { onMessage, onOpen, onClose, onError };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      callbacksRef.current.onOpen?.();
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      callbacksRef.current.onClose?.(event);

      // Auto-reconnect logic
      if (
        shouldReconnectRef.current &&
        reconnectAttemptsRef.current < maxReconnectAttempts
      ) {
        const delay = Math.min(
          reconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
          30000
        );
        reconnectAttemptsRef.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      callbacksRef.current.onError?.(error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as TReceive;
        callbacksRef.current.onMessage(data);
      } catch (error) {
        console.error("[WebSocket] Failed to parse message:", error);
      }
    };
  }, [url, reconnectDelay, maxReconnectAttempts]);

  const send = useCallback((data: TSend) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn("[WebSocket] Cannot send - connection not open");
    }
  }, []);

  const close = useCallback(() => {
    shouldReconnectRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const reconnectManual = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    shouldReconnectRef.current = shouldReconnect;

    if (wsRef.current) {
      wsRef.current.close();
    }

    if (enabled) {
      connect();
    }
  }, [connect, enabled, shouldReconnect]);

  useEffect(() => {
    if (!enabled) {
      close();
      return;
    }

    connect();

    return () => {
      shouldReconnectRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, connect, close]);

  return {
    isConnected,
    send,
    close,
    reconnect: reconnectManual,
  };
}
