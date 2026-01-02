"use client"

/**
 * Fetch-based SSE client for POST requests with streaming responses.
 * Unlike EventSource which only supports GET, this allows sending
 * request bodies while receiving SSE streams.
 */

export interface FetchSSEOptions<T> {
  /** URL to POST to */
  url: string
  /** Request body (will be JSON stringified) */
  body: unknown
  /** Callback for each received event */
  onEvent: (event: T) => void
  /** Callback when stream completes */
  onComplete?: () => void
  /** Callback on error */
  onError?: (error: Error) => void
  /** AbortSignal for cancellation */
  signal?: AbortSignal
  /** SSE event name to listen for (default: "message") */
  eventName?: string
}

/**
 * Parse SSE data from a text chunk.
 * SSE format: "event: name\ndata: json\n\n"
 */
function parseSSEChunk(chunk: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = []
  const lines = chunk.split("\n")

  let currentEvent = "message"
  let currentData = ""

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      currentEvent = line.slice(7).trim()
    } else if (line.startsWith("data: ")) {
      currentData = line.slice(6)
    } else if (line === "" && currentData) {
      events.push({ event: currentEvent, data: currentData })
      currentEvent = "message"
      currentData = ""
    }
  }

  return events
}

/**
 * Fetch with SSE response parsing.
 * Makes a POST request and parses the streaming SSE response.
 *
 * @example
 * ```ts
 * const controller = new AbortController();
 *
 * await fetchSSE<AgentEvent>({
 *   url: '/api/sessions/123/agent/chat',
 *   body: { content: 'Hello', history: [] },
 *   onEvent: (event) => console.log(event),
 *   onComplete: () => console.log('Done'),
 *   signal: controller.signal,
 * });
 *
 * // To cancel:
 * controller.abort();
 * ```
 */
export async function fetchSSE<T>(options: FetchSSEOptions<T>): Promise<void> {
  const { url, body, onEvent, onComplete, onError, signal, eventName = "message" } = options

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    if (!response.body) {
      throw new Error("No response body")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // Process any remaining buffer content
        if (buffer.trim()) {
          const events = parseSSEChunk(buffer)
          for (const { event, data } of events) {
            if (event === eventName && data) {
              try {
                onEvent(JSON.parse(data) as T)
              } catch {
                console.error("[SSE] Failed to parse event data:", data)
              }
            }
          }
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // Process complete events (ending with double newline)
      const parts = buffer.split("\n\n")
      buffer = parts.pop() || "" // Keep incomplete chunk in buffer

      for (const part of parts) {
        if (!part.trim()) continue

        const events = parseSSEChunk(part + "\n\n")
        for (const { event, data } of events) {
          if (event === eventName && data) {
            try {
              onEvent(JSON.parse(data) as T)
            } catch {
              console.error("[SSE] Failed to parse event data:", data)
            }
          }
        }
      }
    }

    onComplete?.()
  } catch (error) {
    // Don't report abort errors
    if (error instanceof Error && error.name === "AbortError") {
      onComplete?.()
      return
    }
    onError?.(error instanceof Error ? error : new Error(String(error)))
  }
}
