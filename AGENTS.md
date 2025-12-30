# AGENTS.md - Coding Agent Guidelines

This document provides guidelines for AI coding agents operating in this repository.

## Project Overview

A monorepo for an IFC (Industry Foundation Classes) viewer platform with AI agent integration.

```
apps/
  api/          # Elysia backend server
  web/          # React + Vite frontend
packages/
  agent/        # AI agent with Anthropic SDK
  compute/      # Sandbox/Computer abstractions
  core/         # Domain entities and interfaces
  database/     # Database implementations
  ifc-viewer/   # IFC 3D viewer components
  realtime/     # SSE/WebSocket utilities
  sdk/          # Type-safe API client (Eden treaty)
  storage/      # Blob storage abstractions
  ui/           # Shared UI components (shadcn/ui style)
```

## Package Manager: Bun

**IMPORTANT: Use Bun exclusively.** Do not use Node.js, npm, pnpm, yarn, vite CLI, or other tools.

```bash
# Package management
bun install                    # Install dependencies
bunx <package>                 # Run package binaries (not npx)

# Running files
bun <file.ts>                  # Run TypeScript directly (not node/ts-node)
bun --hot <file.ts>            # Run with hot reload
```

## Build Commands

```bash
# Development
bun run dev                    # Start both API and web servers
bun run dev:api                # Start API server only (port 3000)
bun run dev:web                # Start web frontend only

# Build
bun run build                  # Build all packages

# Type checking
bun run typecheck              # Type check all packages
bun --filter=@ifc-viewer/api run typecheck    # Type check single package
```

## Testing

Uses Bun's built-in test runner (`bun:test`).

```bash
# Run all tests
bun test

# Run single test file
bun test packages/storage/tests/base.test.ts

# Run tests matching pattern
bun test --test-name-pattern "handles string input"

# Run tests in specific package
bun test packages/storage/tests/
```

### Test File Structure

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";

describe("FeatureName", () => {
  beforeEach(() => {
    // Setup
  });

  test("does something specific", () => {
    const result = doSomething();
    expect(result).toBe(expected);
  });

  test("handles edge case", () => {
    expect(() => doSomething(null)).toThrow();
  });
});
```

## Code Style Guidelines

### File Naming

- **Source files:** kebab-case (`file-tools.ts`, `use-sse.ts`, `chat-panel.tsx`)
- **Test files:** `*.test.ts` in `tests/` directory
- **React components:** kebab-case files, PascalCase exports

### Naming Conventions

- **Functions:** camelCase (`createAgent`, `toBytes`, `inferContentType`)
- **Classes:** PascalCase (`BimAgent`, `DomainError`, `BaseStorageObject`)
- **Interfaces/Types:** PascalCase (`StorageProvider`, `AgentConfig`)
- **Constants:** UPPER_SNAKE_CASE for system prompts (`BIM_IDE_SYSTEM_PROMPT`)
- **React hooks:** `use` prefix (`useSSE`, `useViewer`, `useEditor`)
- **React components:** PascalCase (`Button`, `ChatPanel`, `ViewerProvider`)

### Import Order

1. External packages
2. Internal workspace packages (`@ifc-viewer/*`)
3. Relative imports
4. Type-only imports use `import type`

```typescript
import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import * as React from "react";

import type { Computer } from "@ifc-viewer/compute";
import { createFileTools } from "./tools/file-tools";

import type { AgentEvent } from "./events";
```

### Export Patterns

```typescript
// Named exports preferred
export { Button, buttonVariants };
export function createAgent(config: BimAgentConfig): BimAgent { }

// Barrel exports from index.ts
export * from "./entities";
export * from "./repositories";

// Default exports for React page components only
export default function App() { }
```

### TypeScript Guidelines

- Strict mode enabled (`strict: true`)
- Use `interface` for object shapes, `type` for unions/aliases
- Use `type` for function signatures
- Always specify return types for public functions
- Use `readonly` for immutable properties

```typescript
export interface BimAgentConfig {
  computer: Computer;
  getTerminal: () => Promise<TerminalSession>;
  model?: string;
}

export type AgentEvent =
  | { type: "text-delta"; content: string }
  | { type: "error"; message: string };
```

### Error Handling

Use domain-specific error classes extending `DomainError`:

```typescript
import { DomainError } from "@ifc-viewer/core";

export class SessionNotFoundError extends DomainError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`, "SESSION_NOT_FOUND", 404);
    this.name = "SessionNotFoundError";
  }
}

// Type guard for error checking
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
```

### React Patterns

- Function components only (no class components)
- Context providers for shared state (`ViewerProvider`, `EditorProvider`)
- Tailwind CSS with `cn()` utility for class merging
- Use `class-variance-authority` for component variants

```typescript
import * as React from "react";
import { cn } from "../lib/utils";

function Button({ className, variant, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
```

### Bun-Specific APIs

Prefer Bun built-ins over Node.js alternatives:

```typescript
// File operations
const file = Bun.file("path/to/file");
const text = await file.text();

// Shell commands
const result = await Bun.$`ls -la`;

// Built-in modules (no external packages needed)
import { Database } from "bun:sqlite";  // Not better-sqlite3
// WebSocket is global                   // Not ws package
// Bun.serve() for HTTP                  // Not express
```

### Module Structure

```
packages/{name}/
  src/
    index.ts          # Barrel exports
    types.ts          # Type definitions
    {feature}/        # Feature modules
    providers/        # Implementation providers
  tests/
    *.test.ts
  package.json
  tsconfig.json
```

## Linting & Formatting

No ESLint/Prettier configured. The codebase relies on:
- TypeScript strict mode for code quality
- Consistent patterns established by existing code
- IDE formatting (VS Code/Cursor defaults)

## Environment

- Bun automatically loads `.env` files (no dotenv needed)
- Use `process.env.VARIABLE` for environment variables
