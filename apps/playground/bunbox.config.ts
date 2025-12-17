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
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
};

export default config;
