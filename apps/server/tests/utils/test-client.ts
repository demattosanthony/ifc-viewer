/**
 * Test HTTP Client
 *
 * A typed HTTP client that wraps Elysia's `.handle()` method
 * for simulating HTTP requests without starting a server.
 */

import type { createApp } from "../../src/create-app.ts"

type App = ReturnType<typeof createApp>

interface Response<T> {
  status: number
  data: T
}

export class TestClient {
  constructor(
    private app: App,
    private baseUrl = "http://test"
  ) {}

  async get<T = unknown>(path: string): Promise<Response<T>> {
    const response = await this.app.handle(new Request(`${this.baseUrl}${path}`, { method: "GET" }))
    return {
      status: response.status,
      data: (await response.json()) as T,
    }
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<Response<T>> {
    const response = await this.app.handle(
      new Request(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      })
    )
    return {
      status: response.status,
      data: (await response.json()) as T,
    }
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<Response<T>> {
    const response = await this.app.handle(
      new Request(`${this.baseUrl}${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      })
    )
    return {
      status: response.status,
      data: (await response.json()) as T,
    }
  }

  async delete<T = unknown>(path: string): Promise<Response<T>> {
    const response = await this.app.handle(
      new Request(`${this.baseUrl}${path}`, { method: "DELETE" })
    )
    return {
      status: response.status,
      data: (await response.json()) as T,
    }
  }

  /**
   * For multipart uploads (e.g., file uploads)
   */
  async upload<T = unknown>(path: string, formData: FormData): Promise<Response<T>> {
    const response = await this.app.handle(
      new Request(`${this.baseUrl}${path}`, {
        method: "POST",
        body: formData,
      })
    )
    return {
      status: response.status,
      data: (await response.json()) as T,
    }
  }
}
