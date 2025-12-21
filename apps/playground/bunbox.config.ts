/**
 * Bunbox configuration
 * All fields are optional and have sensible defaults
 */

import type { BunboxConfig } from "@ademattos/bunbox";

const config: BunboxConfig = {
  port: 3000,
  hostname: "localhost",
  appDir: "./app",
  publicDir: "./public",
  openapi: {
    enabled: true,
    title: "IFC Viewer Playground API",
    description: "API for the IFC Viewer Playground",
    version: "1.0.0",
  },
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
};

export default config;
