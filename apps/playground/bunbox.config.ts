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
  maxBodySize: 1024 * 1024 * 1024 * 100, // 100 GB
};

export default config;
