import { rm } from "node:fs/promises";
import { join } from "node:path";

const rootDir = import.meta.dir.replace("/scripts", "");
const distDir = join(rootDir, "dist");

// Clean dist directory
console.log("Cleaning dist directory...");
await rm(distDir, { recursive: true, force: true });

// External dependencies that should not be bundled
const external = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "three",
  "@thatopen/components",
  "@thatopen/components-front",
  "@thatopen/fragments",
  "web-ifc",
  "stats.js",
];

// Build main entry point (React components)
console.log("Building main entry point...");
const mainResult = await Bun.build({
  entrypoints: [join(rootDir, "src/index.ts")],
  outdir: distDir,
  format: "esm",
  target: "browser",
  splitting: true,
  sourcemap: "external",
  external,
  naming: "[dir]/[name].[ext]",
});

if (!mainResult.success) {
  console.error("Main build failed:");
  for (const log of mainResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Build core entry point
console.log("Building core entry point...");
const coreResult = await Bun.build({
  entrypoints: [join(rootDir, "src/core/index.ts")],
  outdir: join(distDir, "core"),
  format: "esm",
  target: "browser",
  splitting: true,
  sourcemap: "external",
  external,
  naming: "[dir]/[name].[ext]",
});

if (!coreResult.success) {
  console.error("Core build failed:");
  for (const log of coreResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Generate TypeScript declarations
console.log("Generating TypeScript declarations...");
const tscProcess = Bun.spawn(["bunx", "tsc", "-p", "tsconfig.build.json"], {
  cwd: rootDir,
  stdout: "inherit",
  stderr: "inherit",
});

const tscExitCode = await tscProcess.exited;
if (tscExitCode !== 0) {
  console.error("TypeScript declaration generation failed");
  process.exit(1);
}

console.log("Build completed successfully!");
console.log(`Output: ${distDir}`);
