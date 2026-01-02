/**
 * Base utilities for storage providers.
 */

import type { Storage } from "@ifc-viewer/core"

/**
 * Default implementation of Storage.Object.
 * Wraps binary data with convenient accessor methods.
 */
export class BaseStorageObject implements Storage.Object {
  constructor(
    readonly data: Uint8Array,
    readonly metadata: Storage.Metadata
  ) {}

  text(): string {
    return new TextDecoder().decode(this.data)
  }

  json<T = unknown>(): T {
    return JSON.parse(this.text())
  }

  stream(): ReadableStream<Uint8Array> {
    const data = this.data
    return new ReadableStream({
      start(controller) {
        controller.enqueue(data)
        controller.close()
      },
    })
  }
}

/**
 * Convert various input types to Uint8Array.
 */
export async function toBytes(input: Storage.Input): Promise<Uint8Array> {
  if (input instanceof Uint8Array) {
    return input
  }

  if (typeof input === "string") {
    return new TextEncoder().encode(input)
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input)
  }

  if (input instanceof Blob) {
    const buffer = await input.arrayBuffer()
    return new Uint8Array(buffer)
  }

  // ReadableStream
  if (isReadableStream(input)) {
    return await streamToBytes(input)
  }

  throw new Error(`Unsupported input type: ${typeof input}`)
}

/**
 * Type guard for ReadableStream.
 */
function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ReadableStream).getReader === "function"
  )
}

/**
 * Collect a stream into a Uint8Array.
 */
export async function streamToBytes(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let totalLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    totalLength += value.length
  }

  // Combine chunks into single array
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
}

/**
 * Infer content type from key/filename.
 */
export function inferContentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase()

  const mimeTypes: Record<string, string> = {
    // Text
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    json: "application/json",
    xml: "application/xml",

    // Code
    ts: "text/typescript",
    tsx: "text/typescript",
    jsx: "text/javascript",
    py: "text/x-python",
    md: "text/markdown",

    // Images
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",

    // Binary
    pdf: "application/pdf",
    zip: "application/zip",
    ifc: "application/x-step",

    // 3D
    gltf: "model/gltf+json",
    glb: "model/gltf-binary",
    obj: "model/obj",
  }

  return mimeTypes[ext || ""] || "application/octet-stream"
}
