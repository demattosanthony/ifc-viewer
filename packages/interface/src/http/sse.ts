/**
 * Server-Side Events (SSE) utilities for streaming responses
 */

/**
 * Context for sending SSE events
 */
export interface SSEContext {
  /**
   * Send an event to the client
   */
  send(event: string, data: unknown): void

  /**
   * Send a named event with data
   */
  sendEvent(name: string, data: unknown): void

  /**
   * Close the SSE connection
   */
  close(): void

  /**
   * Check if the connection is still open
   */
  readonly isOpen: boolean
}

/**
 * Options for creating an SSE stream
 */
export interface SSEStreamOptions {
  /**
   * Retry interval in milliseconds for client reconnection
   * @default 3000
   */
  retry?: number
}

/**
 * Create an SSE stream that can be used as a response body
 *
 * @example
 * ```ts
 * const stream = createSSEStream(async (ctx) => {
 *   ctx.send('message', { hello: 'world' });
 *   await someAsyncOperation();
 *   ctx.send('complete', { done: true });
 *   ctx.close();
 * });
 *
 * return new Response(stream, {
 *   headers: {
 *     'Content-Type': 'text/event-stream',
 *     'Cache-Control': 'no-cache',
 *     'Connection': 'keep-alive',
 *   },
 * });
 * ```
 */
export function createSSEStream(
  onConnect: (ctx: SSEContext) => void | Promise<void>,
  options?: SSEStreamOptions
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let isOpen = true
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null

  const ctx: SSEContext = {
    send(event: string, data: unknown) {
      if (!isOpen || !controller) return

      const jsonData = JSON.stringify(data)
      const message = `event: ${event}\ndata: ${jsonData}\n\n`
      controller.enqueue(encoder.encode(message))
    },

    sendEvent(name: string, data: unknown) {
      this.send(name, data)
    },

    close() {
      if (!isOpen || !controller) return
      isOpen = false
      controller.close()
    },

    get isOpen() {
      return isOpen
    },
  }

  return new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl

      // Send retry interval if specified
      if (options?.retry) {
        controller.enqueue(encoder.encode(`retry: ${options.retry}\n\n`))
      }

      // Start the handler
      Promise.resolve(onConnect(ctx)).catch((error) => {
        console.error("[SSE] Error in handler:", error)
        if (isOpen) {
          ctx.send("error", { message: error.message })
          ctx.close()
        }
      })
    },

    cancel() {
      isOpen = false
    },
  })
}

/**
 * Create an SSE Response with proper headers
 */
export function sseResponse(
  stream: ReadableStream<Uint8Array>,
  headers?: Record<string, string>
): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
      ...headers,
    },
  })
}
