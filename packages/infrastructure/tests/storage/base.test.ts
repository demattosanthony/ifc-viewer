/**
 * Storage Base Utilities Tests
 *
 * Tests for the base storage utilities including type conversion
 * and content type inference.
 */

import { describe, test, expect } from "bun:test"
import { BaseStorageObject, toBytes, streamToBytes, inferContentType } from "../../src/storage/base"

describe("toBytes", () => {
  test("converts string to Uint8Array", async () => {
    const result = await toBytes("hello world")
    expect(result).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(result)).toBe("hello world")
  })

  test("handles empty string", async () => {
    const result = await toBytes("")
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(0)
  })

  test("handles unicode string", async () => {
    const result = await toBytes("hello 世界 🌍")
    expect(new TextDecoder().decode(result)).toBe("hello 世界 🌍")
  })

  test("returns Uint8Array as-is", async () => {
    const input = new Uint8Array([1, 2, 3, 4, 5])
    const result = await toBytes(input)
    expect(result).toBe(input)
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
  })

  test("converts ArrayBuffer to Uint8Array", async () => {
    const buffer = new ArrayBuffer(4)
    const view = new Uint8Array(buffer)
    view.set([10, 20, 30, 40])

    const result = await toBytes(buffer)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result).toEqual(new Uint8Array([10, 20, 30, 40]))
  })

  test("converts Blob to Uint8Array", async () => {
    const blob = new Blob(["test data"], { type: "text/plain" })
    const result = await toBytes(blob)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(result)).toBe("test data")
  })

  test("converts ReadableStream to Uint8Array", async () => {
    const chunks = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
    ]
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })

    const result = await toBytes(stream)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]))
  })
})

describe("streamToBytes", () => {
  test("collects single chunk stream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.close()
      },
    })

    const result = await streamToBytes(stream)
    expect(result).toEqual(new Uint8Array([1, 2, 3]))
  })

  test("collects multi-chunk stream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
        controller.enqueue(new Uint8Array([3, 4]))
        controller.enqueue(new Uint8Array([5]))
        controller.close()
      },
    })

    const result = await streamToBytes(stream)
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
  })

  test("handles empty stream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    })

    const result = await streamToBytes(stream)
    expect(result).toEqual(new Uint8Array([]))
  })
})

describe("inferContentType", () => {
  describe("text files", () => {
    test("identifies plain text", () => {
      expect(inferContentType("readme.txt")).toBe("text/plain")
    })

    test("identifies HTML", () => {
      expect(inferContentType("index.html")).toBe("text/html")
    })

    test("identifies CSS", () => {
      expect(inferContentType("styles.css")).toBe("text/css")
    })

    test("identifies JavaScript", () => {
      expect(inferContentType("app.js")).toBe("text/javascript")
    })

    test("identifies JSON", () => {
      expect(inferContentType("data.json")).toBe("application/json")
    })

    test("identifies XML", () => {
      expect(inferContentType("config.xml")).toBe("application/xml")
    })
  })

  describe("code files", () => {
    test("identifies TypeScript", () => {
      expect(inferContentType("app.ts")).toBe("text/typescript")
      expect(inferContentType("component.tsx")).toBe("text/typescript")
    })

    test("identifies JSX", () => {
      expect(inferContentType("component.jsx")).toBe("text/javascript")
    })

    test("identifies Python", () => {
      expect(inferContentType("script.py")).toBe("text/x-python")
    })

    test("identifies Markdown", () => {
      expect(inferContentType("README.md")).toBe("text/markdown")
    })
  })

  describe("image files", () => {
    test("identifies PNG", () => {
      expect(inferContentType("image.png")).toBe("image/png")
    })

    test("identifies JPEG", () => {
      expect(inferContentType("photo.jpg")).toBe("image/jpeg")
      expect(inferContentType("photo.jpeg")).toBe("image/jpeg")
    })

    test("identifies GIF", () => {
      expect(inferContentType("animation.gif")).toBe("image/gif")
    })

    test("identifies SVG", () => {
      expect(inferContentType("icon.svg")).toBe("image/svg+xml")
    })

    test("identifies WebP", () => {
      expect(inferContentType("image.webp")).toBe("image/webp")
    })
  })

  describe("binary files", () => {
    test("identifies PDF", () => {
      expect(inferContentType("document.pdf")).toBe("application/pdf")
    })

    test("identifies ZIP", () => {
      expect(inferContentType("archive.zip")).toBe("application/zip")
    })

    test("identifies IFC", () => {
      expect(inferContentType("model.ifc")).toBe("application/x-step")
    })
  })

  describe("3D files", () => {
    test("identifies GLTF", () => {
      expect(inferContentType("model.gltf")).toBe("model/gltf+json")
    })

    test("identifies GLB", () => {
      expect(inferContentType("model.glb")).toBe("model/gltf-binary")
    })

    test("identifies OBJ", () => {
      expect(inferContentType("model.obj")).toBe("model/obj")
    })
  })

  describe("edge cases", () => {
    test("returns octet-stream for unknown extension", () => {
      expect(inferContentType("file.xyz")).toBe("application/octet-stream")
      expect(inferContentType("file.unknown")).toBe("application/octet-stream")
    })

    test("returns octet-stream for no extension", () => {
      expect(inferContentType("Makefile")).toBe("application/octet-stream")
      expect(inferContentType("LICENSE")).toBe("application/octet-stream")
    })

    test("handles uppercase extensions", () => {
      expect(inferContentType("FILE.TXT")).toBe("text/plain")
      expect(inferContentType("IMAGE.PNG")).toBe("image/png")
    })

    test("handles paths with directories", () => {
      expect(inferContentType("src/components/app.tsx")).toBe("text/typescript")
      expect(inferContentType("/var/data/config.json")).toBe("application/json")
    })
  })
})

describe("BaseStorageObject", () => {
  const createObject = (content: string, contentType = "text/plain") => {
    const data = new TextEncoder().encode(content)
    return new BaseStorageObject(data, {
      key: "test-key",
      size: data.byteLength,
      contentType,
      lastModified: new Date(),
    })
  }

  test("text() returns decoded string", () => {
    const obj = createObject("hello world")
    expect(obj.text()).toBe("hello world")
  })

  test("text() handles unicode", () => {
    const obj = createObject("hello 世界 🌍")
    expect(obj.text()).toBe("hello 世界 🌍")
  })

  test("json() parses JSON content", () => {
    const obj = createObject('{"name": "test", "value": 123}', "application/json")
    expect(obj.json<{ name: string; value: number }>()).toEqual({ name: "test", value: 123 })
  })

  test("json() throws on invalid JSON", () => {
    const obj = createObject("not json")
    expect(() => obj.json()).toThrow()
  })

  test("stream() returns readable stream", async () => {
    const obj = createObject("stream content")
    const stream = obj.stream()
    expect(stream).toBeInstanceOf(ReadableStream)

    const reader = stream.getReader()
    const { value, done } = await reader.read()
    expect(done).toBe(false)
    expect(new TextDecoder().decode(value)).toBe("stream content")

    const { done: done2 } = await reader.read()
    expect(done2).toBe(true)
  })

  test("metadata is accessible", () => {
    const obj = createObject("test")
    expect(obj.metadata.key).toBe("test-key")
    expect(obj.metadata.contentType).toBe("text/plain")
    expect(obj.metadata.size).toBe(4)
    expect(obj.metadata.lastModified).toBeInstanceOf(Date)
  })

  test("data is accessible as Uint8Array", () => {
    const obj = createObject("test")
    expect(obj.data).toBeInstanceOf(Uint8Array)
    expect(obj.data.length).toBe(4)
  })
})
