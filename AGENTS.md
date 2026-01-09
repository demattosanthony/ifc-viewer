# AGENTS.md - Coding Agent Guidelines

Guidelines for AI coding agents operating in this repository.

## Project Structure

Monorepo for an IFC (Industry Foundation Classes) viewer platform with AI agent integration.

```
apps/server/             # Elysia server - HTTP + WebSocket (port 3000)
apps/web/                # React + Vite frontend
packages/core/           # Domain entities, services, port interfaces
packages/interface/      # DTOs and HTTP controllers
packages/infrastructure/ # Database, storage, compute implementations
packages/ifc-viewer/     # IFC 3D viewer (Three.js + web-ifc)
packages/logger/         # Structured logging
packages/sdk/            # Auto-generated type-safe API client
packages/ui/             # Shared UI components (shadcn/ui)
```

## Package Manager: Bun

**CRITICAL: Use Bun exclusively.** Never use npm, pnpm, yarn, or vite CLI.

```bash
bun install              # Install dependencies
bun <file.ts>            # Run TypeScript directly
bunx <package>           # Run package binaries
```

Prefer Bun APIs: `Bun.file()` over fs, `Bun.$`cmd`` over execa.

## Commands

```bash
# Development
bun run dev              # Start server + web (requires Docker for Postgres)
bun run dev:server       # Server only (port 3000)
bun run dev:web          # Web frontend only

# Build & Check
bun run build            # Build all packages
bun run typecheck        # Type check all packages

# Database
bun run db:start         # Start Postgres container
bun run db:stop          # Stop Postgres container

# SDK (regenerate after API changes)
bun run generate:sdk     # Requires server running

# Docker
bun run docker:build:bim-ide  # Build compute container
```

## Testing

Uses Bun's built-in test runner (`bun:test`).

```bash
bun test                                          # Run all tests
bun test packages/core/tests/                     # Run tests in directory
bun test packages/core/tests/domain/slug.test.ts  # Run single test file
bun test --test-name-pattern "creates project"    # Filter by test name
```

Test structure:

```typescript
import { describe, test, expect } from "bun:test";
describe("Feature", () => {
  test("does something", () => {
    expect(result).toBe(expected);
  });
});
```

## Code Style

### Naming Conventions

| Type          | Convention       | Example                       |
| ------------- | ---------------- | ----------------------------- |
| Files         | kebab-case       | `file-tools.ts`, `use-sse.ts` |
| Functions     | camelCase        | `createAgent`, `toBytes`      |
| Classes/Types | PascalCase       | `BimAgent`, `StorageProvider` |
| Constants     | UPPER_SNAKE_CASE | `FLUSH_INTERVAL_MS`           |
| React hooks   | `use` prefix     | `useSSE`, `useViewer`         |

### Import Order

1. Node.js built-ins (`node:fs`, `node:path`)
2. External packages (`react`, `elysia`, `three`)
3. Internal workspace packages (`@ifc-viewer/*`)
4. Relative imports (`./`, `../`)

Use `import type` for type-only imports.

### TypeScript

- Strict mode with `noUncheckedIndexedAccess` enabled
- Use `interface` for object shapes, `type` for unions/aliases
- Specify return types for exported functions
- Use `.ts` extensions in imports (required by `verbatimModuleSyntax`)
- Use Zod schemas with inference: `type Project = z.infer<typeof ProjectSchema>`

### Error Handling

Extend `DomainError` from `@ifc-viewer/core`:

```typescript
export class SessionNotFoundError extends DomainError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`, "SESSION_NOT_FOUND", 404);
    this.name = "SessionNotFoundError";
  }
}
```

### Logging

Use `@ifc-viewer/logger` for server-side logging. Create child loggers for subsystems:

```typescript
const log = createLogger("server");
log.info("Started", { port: 3000 });
const dbLog = log.child("database"); // Creates "server:database" namespace
```

### Package Structure

Each package has `src/` (with `index.ts` barrel exports), `tests/*.test.ts`, `package.json`, `tsconfig.json`.

## SDK Usage (CRITICAL)

**NEVER use `fetch()` directly in `apps/web/`.** Always use `@ifc-viewer/sdk`.

```typescript
import { useMutation, useQuery } from "@tanstack/react-query";
import { listFilesOptions, writeFileMutation } from "@ifc-viewer/sdk/hooks";

// Queries
const { data } = useQuery(
  listFilesOptions({ path: { id }, query: { path: "." } })
);

// Mutations
const writeFile = useMutation(writeFileMutation());
await writeFile.mutateAsync({
  path: { id },
  body: { path: "file.txt", content: "hi" },
});
```

**When you modify API routes, regenerate the SDK:** `bun run generate:sdk`

Exceptions where `fetch()` is OK: SSE streaming (`fetchSSE`), external APIs, S3 presigned uploads.

## React Patterns

Function components with hooks, context providers for shared state, Tailwind CSS with `cn()` from `@ifc-viewer/ui`.

## Environment

- Bun auto-loads `.env` files (no dotenv needed)
- Copy `.env.example` to `.env` for local development

## Linting

No ESLint/Prettier configured. Follow TypeScript strict mode and match existing patterns.
