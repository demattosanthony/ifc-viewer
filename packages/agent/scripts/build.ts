import { rm } from "node:fs/promises";
import { join } from "node:path";

const rootDir = import.meta.dir.replace("/scripts", "");
const distDir = join(rootDir, "dist");

// Clean dist directory
console.log("Cleaning dist directory...");
await rm(distDir, { recursive: true, force: true });

// Build main entry point
console.log("Building main entry point...");
const mainResult = await Bun.build({
  entrypoints: [join(rootDir, "src/index.ts")],
  outdir: distDir,
  format: "esm",
  target: "bun",
  splitting: true,
  sourcemap: "external",
  naming: "[dir]/[name].[ext]",
  external: ["@ifc-viewer/computer"],
});

if (!mainResult.success) {
  console.error("Build failed:");
  for (const log of mainResult.logs) {
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
