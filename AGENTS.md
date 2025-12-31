# AGENTS.md - Coding Agent Guidelines

Guidelines for AI coding agents operating in this repository.

## Project Overview

Monorepo for an IFC (Industry Foundation Classes) viewer platform with AI agent integration.

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

**CRITICAL: Use Bun exclusively.** Never use Node.js, npm, pnpm, yarn, or vite CLI.

```bash
bun install          # Install deps (not npm/yarn/pnpm)
bun <file.ts>        # Run TypeScript (not node/ts-node)
bunx <package>       # Run binaries (not npx)
```

## Commands

```bash
bun run dev                    # Start API + web servers
bun run dev:api                # API server only (port 3000)
bun run dev:web                # Web frontend only
bun run build                  # Build all packages
bun run typecheck              # Type check all packages
bun --filter=@ifc-viewer/api run typecheck  # Single package
bun run generate:sdk           # Generate SDK from OpenAPI
```

## Testing

Uses Bun's built-in test runner (`bun:test`).

```bash
bun test                                      # All tests
bun test packages/storage/tests/base.test.ts  # Single file
bun test packages/storage/tests/              # Directory
bun test --test-name-pattern "handles string" # Pattern match
```

Test structure: `import { describe, test, expect } from "bun:test";`

## Code Style

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `file-tools.ts`, `use-sse.ts` |
| Functions | camelCase | `createAgent`, `toBytes` |
| Classes | PascalCase | `BimAgent`, `DomainError` |
| Interfaces/Types | PascalCase | `StorageProvider`, `AgentConfig` |
| Constants | UPPER_SNAKE_CASE | `BIM_IDE_SYSTEM_PROMPT` |
| React hooks | `use` prefix | `useSSE`, `useViewer` |
| React components | PascalCase | `Button`, `ChatPanel` |

### Import Order

1. External packages
2. Internal workspace packages (`@ifc-viewer/*`)
3. Relative imports
4. Use `import type` for type-only imports

```typescript
import { Elysia } from "elysia";
import type { Computer } from "@ifc-viewer/compute";
import { createFileTools } from "./tools/file-tools";
```

### TypeScript

- Strict mode enabled; always specify return types for public functions
- Use `interface` for object shapes, `type` for unions/aliases
- Use `readonly` for immutable properties

### Error Handling

Extend `DomainError` from `@ifc-viewer/core`:

```typescript
import { DomainError } from "@ifc-viewer/core";

export class SessionNotFoundError extends DomainError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`, "SESSION_NOT_FOUND", 404);
    this.name = "SessionNotFoundError";
  }
}
```

### React Patterns

- Function components only; context providers for shared state
- Tailwind CSS with `cn()` utility; `class-variance-authority` for variants

```typescript
import * as React from "react";
import { cn } from "@ifc-viewer/ui/lib/utils";

function Button({ className, variant, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, className }))} {...props} />
  );
}
export { Button, buttonVariants };
```

### Bun APIs

Prefer Bun built-ins over Node.js alternatives:

```typescript
const file = Bun.file("path/to/file");    // Not fs.readFile
const result = await Bun.$`ls -la`;       // Not execa
import { Database } from "bun:sqlite";    // Not better-sqlite3
```

### Module Structure

```
packages/{name}/
  src/
    index.ts          # Barrel exports
    types.ts          # Type definitions
    providers/        # Implementation providers
  tests/*.test.ts
  package.json, tsconfig.json
```

### Exports

Named exports preferred; default exports for React page components only.

## Environment

- Bun automatically loads `.env` files (no dotenv needed)
- Use `process.env.VARIABLE` for environment variables

## Linting

No ESLint/Prettier. Follow TypeScript strict mode and existing code patterns.
