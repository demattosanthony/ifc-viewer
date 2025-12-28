import { rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const rootDir = import.meta.dir.replace("/scripts", "");
const distDir = join(rootDir, "dist");
const workerSourcePath = join(
  rootDir,
  "node_modules/@thatopen/fragments/dist/Worker/worker.mjs"
);

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

// Generate worker utility with inlined worker code
console.log("Generating worker utility...");
try {
  const workerCode = await readFile(workerSourcePath, "utf-8");

  // Create the worker utility that exports a function to get the worker URL
  const workerUtility = `// Auto-generated - Do not edit
// This file contains the inlined worker from @thatopen/fragments

const workerCode = ${JSON.stringify(workerCode)};

let cachedWorkerUrl: string | null = null;

/**
 * Returns a Blob URL for the fragments worker.
 * The URL is cached after first creation.
 */
export function getFragmentsWorkerUrl(): string {
  if (cachedWorkerUrl) {
    return cachedWorkerUrl;
  }

  const blob = new Blob([workerCode], { type: "application/javascript" });
  cachedWorkerUrl = URL.createObjectURL(blob);
  return cachedWorkerUrl;
}
`;

  await writeFile(join(distDir, "worker.js"), workerUtility);

  // Also generate TypeScript declaration
  const workerDeclaration = `// Auto-generated - Do not edit
/**
 * Returns a Blob URL for the fragments worker.
 * The URL is cached after first creation.
 */
export declare function getFragmentsWorkerUrl(): string;
`;
  await writeFile(join(distDir, "worker.d.ts"), workerDeclaration);

  console.log("Worker utility generated successfully!");
} catch (error) {
  console.error("Failed to generate worker utility:", error);
  process.exit(1);
}

console.log("Build completed successfully!");
console.log(`Output: ${distDir}`);
