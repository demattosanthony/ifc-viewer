import { describe, test, expect } from "bun:test";
import {
  BaseStorageObject,
  toBytes,
  streamToBytes,
  inferContentType,
} from "../src/base";

describe("BaseStorageObject", () => {
  test("stores data and metadata", () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const metadata = {
      key: "test.txt",
      size: 5,
      contentType: "text/plain",
    };

    const obj = new BaseStorageObject(data, metadata);

    expect(obj.data).toEqual(data);
    expect(obj.metadata).toEqual(metadata);
  });

  test("text() decodes UTF-8", () => {
    const data = new TextEncoder().encode("Hello, World!");
    const obj = new BaseStorageObject(data, { key: "test", size: data.length });

    expect(obj.text()).toBe("Hello, World!");
  });

  test("text() handles unicode", () => {
    const data = new TextEncoder().encode("Hello 世界 🌍");
    const obj = new BaseStorageObject(data, { key: "test", size: data.length });

    expect(obj.text()).toBe("Hello 世界 🌍");
  });

  test("json() parses JSON", () => {
    const data = new TextEncoder().encode('{"name":"test","value":42}');
    const obj = new BaseStorageObject(data, { key: "test.json", size: data.length });

    const parsed = obj.json<{ name: string; value: number }>();

    expect(parsed.name).toBe("test");
    expect(parsed.value).toBe(42);
  });

  test("json() throws on invalid JSON", () => {
    const data = new TextEncoder().encode("not json");
    const obj = new BaseStorageObject(data, { key: "test", size: data.length });

    expect(() => obj.json()).toThrow();
  });

  test("stream() returns readable stream", async () => {
    const data = new TextEncoder().encode("stream test");
    const obj = new BaseStorageObject(data, { key: "test", size: data.length });

    const stream = obj.stream();
    const reader = stream.getReader();

    const { value, done } = await reader.read();

    expect(done).toBe(false);
    expect(new TextDecoder().decode(value)).toBe("stream test");

    const { done: done2 } = await reader.read();
    expect(done2).toBe(true);
  });
});

describe("toBytes", () => {
  test("handles string input", async () => {
    const bytes = await toBytes("Hello");
    expect(bytes).toEqual(new TextEncoder().encode("Hello"));
  });

  test("handles Uint8Array input", async () => {
    const input = new Uint8Array([1, 2, 3]);
    const bytes = await toBytes(input);
    expect(bytes).toEqual(input);
  });

  test("handles ArrayBuffer input", async () => {
    const buffer = new ArrayBuffer(4);
    new Uint8Array(buffer).set([10, 20, 30, 40]);

    const bytes = await toBytes(buffer);
    expect(Array.from(bytes)).toEqual([10, 20, 30, 40]);
  });

  test("handles Blob input", async () => {
    const blob = new Blob(["blob content"]);
    const bytes = await toBytes(blob);
    expect(new TextDecoder().decode(bytes)).toBe("blob content");
  });

  test("handles ReadableStream input", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("stream"));
        controller.close();
      },
    });

    const bytes = await toBytes(stream);
    expect(new TextDecoder().decode(bytes)).toBe("stream");
  });

  test("handles empty string", async () => {
    const bytes = await toBytes("");
    expect(bytes.length).toBe(0);
  });

  test("handles empty Uint8Array", async () => {
    const bytes = await toBytes(new Uint8Array(0));
    expect(bytes.length).toBe(0);
  });
});

describe("streamToBytes", () => {
  test("collects single chunk", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });

    const bytes = await streamToBytes(stream);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  test("collects multiple chunks", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.enqueue(new Uint8Array([5]));
        controller.close();
      },
    });

    const bytes = await streamToBytes(stream);
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5]);
  });

  test("handles empty stream", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

    const bytes = await streamToBytes(stream);
    expect(bytes.length).toBe(0);
  });
});

describe("inferContentType", () => {
  describe("text files", () => {
    test("txt -> text/plain", () => {
      expect(inferContentType("file.txt")).toBe("text/plain");
    });

    test("html -> text/html", () => {
      expect(inferContentType("page.html")).toBe("text/html");
    });

    test("css -> text/css", () => {
      expect(inferContentType("styles.css")).toBe("text/css");
    });

    test("js -> text/javascript", () => {
      expect(inferContentType("script.js")).toBe("text/javascript");
    });

    test("json -> application/json", () => {
      expect(inferContentType("data.json")).toBe("application/json");
    });

    test("xml -> application/xml", () => {
      expect(inferContentType("config.xml")).toBe("application/xml");
    });
  });

  describe("code files", () => {
    test("ts -> text/typescript", () => {
      expect(inferContentType("app.ts")).toBe("text/typescript");
    });

    test("tsx -> text/typescript", () => {
      expect(inferContentType("component.tsx")).toBe("text/typescript");
    });

    test("jsx -> text/javascript", () => {
      expect(inferContentType("component.jsx")).toBe("text/javascript");
    });

    test("py -> text/x-python", () => {
      expect(inferContentType("script.py")).toBe("text/x-python");
    });

    test("md -> text/markdown", () => {
      expect(inferContentType("README.md")).toBe("text/markdown");
    });
  });

  describe("image files", () => {
    test("png -> image/png", () => {
      expect(inferContentType("image.png")).toBe("image/png");
    });

    test("jpg -> image/jpeg", () => {
      expect(inferContentType("photo.jpg")).toBe("image/jpeg");
    });

    test("jpeg -> image/jpeg", () => {
      expect(inferContentType("photo.jpeg")).toBe("image/jpeg");
    });

    test("gif -> image/gif", () => {
      expect(inferContentType("animation.gif")).toBe("image/gif");
    });

    test("svg -> image/svg+xml", () => {
      expect(inferContentType("icon.svg")).toBe("image/svg+xml");
    });

    test("webp -> image/webp", () => {
      expect(inferContentType("image.webp")).toBe("image/webp");
    });
  });

  describe("binary files", () => {
    test("pdf -> application/pdf", () => {
      expect(inferContentType("document.pdf")).toBe("application/pdf");
    });

    test("zip -> application/zip", () => {
      expect(inferContentType("archive.zip")).toBe("application/zip");
    });

    test("ifc -> application/x-step", () => {
      expect(inferContentType("model.ifc")).toBe("application/x-step");
    });
  });

  describe("3D files", () => {
    test("gltf -> model/gltf+json", () => {
      expect(inferContentType("model.gltf")).toBe("model/gltf+json");
    });

    test("glb -> model/gltf-binary", () => {
      expect(inferContentType("model.glb")).toBe("model/gltf-binary");
    });

    test("obj -> model/obj", () => {
      expect(inferContentType("model.obj")).toBe("model/obj");
    });
  });

  describe("edge cases", () => {
    test("unknown extension -> application/octet-stream", () => {
      expect(inferContentType("file.xyz")).toBe("application/octet-stream");
    });

    test("no extension -> application/octet-stream", () => {
      expect(inferContentType("Makefile")).toBe("application/octet-stream");
    });

    test("handles uppercase extensions", () => {
      expect(inferContentType("IMAGE.PNG")).toBe("image/png");
    });

    test("handles nested path", () => {
      expect(inferContentType("path/to/file.json")).toBe("application/json");
    });
  });
});
