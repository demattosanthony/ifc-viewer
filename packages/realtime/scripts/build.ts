import { $ } from "bun";

// Clean dist
await $`rm -rf dist`;

// Build with tsc for declarations
await $`bunx tsc`;

console.log("Build complete!");
