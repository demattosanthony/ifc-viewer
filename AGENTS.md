# AGENTS.md - Coding Agent Guidelines

Guidelines for AI coding agents operating in this repository.

## Project Overview

Monorepo for an IFC (Industry Foundation Classes) viewer platform with AI agent integration.

```
apps/server/             # Elysia server - HTTP + WebSocket (port 3000)
apps/web/                # React + Vite frontend
packages/core/           # Domain entities, services, and port interfaces
packages/interface/      # DTOs and HTTP controllers
packages/infrastructure/ # Database, storage, compute implementations
packages/ifc-viewer/     # IFC 3D viewer (Three.js + web-ifc)
packages/logger/         # Structured logging with file and console output
packages/sdk/            # Type-safe API client
packages/ui/             # Shared UI components (shadcn/ui)
```

## Package Manager: Bun

**CRITICAL: Use Bun exclusively.** Never use npm, pnpm, yarn, or vite CLI.

```bash
bun install             # Install dependencies
bun <file.ts>           # Run TypeScript directly
bunx <package>          # Run package binaries
```

Prefer Bun APIs: `Bun.file()` over fs, `Bun.$`cmd`` over execa.

## Commands

```bash
# Development
bun run dev                                    # Start server + web (requires Docker)
bun run dev:server                             # Server only (port 3000)
bun run dev:web                                # Web frontend only

# Build & Check
bun run build                                  # Build all packages
bun run typecheck                              # Type check all packages
bun --filter=@ifc-viewer/server run typecheck  # Type check single package

# Database (Postgres via Docker)
bun run db:start                               # Start Postgres container
bun run db:stop                                # Stop Postgres container
bun run db:logs                                # View Postgres logs

# SDK & Docker
bun run generate:sdk                           # Generate SDK from OpenAPI
bun run docker:build:bim-ide                   # Build compute container image
```

## Testing

Uses Bun's built-in test runner (`bun:test`).

```bash
bun test                                          # Run all tests
bun test packages/core/tests/                     # Run tests in directory
bun test packages/core/tests/domain/slug.test.ts  # Run single test file
bun test --test-name-pattern "creates project"    # Filter by test name
```

Test file structure:
```typescript
import { describe, test, expect, beforeEach } from "bun:test"

describe("Feature", () => {
  beforeEach(() => { /* setup */ })

  test("does something", () => {
    expect(result).toBe(expected)
  })
})
```

## Code Style

### Naming Conventions

| Type          | Convention       | Example                       |
|---------------|------------------|-------------------------------|
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

Use `import type` for type-only imports:
```typescript
import { createLogger } from "@ifc-viewer/logger"
import type { Logger, LogLevel } from "@ifc-viewer/logger"
```

### TypeScript

- Strict mode enabled with `noUncheckedIndexedAccess`
- Use `interface` for object shapes, `type` for unions/aliases
- Specify return types for public/exported functions
- Use Zod schemas with inference: `type Project = z.infer<typeof ProjectSchema>`
- Use `.ts` extensions in imports (required by `verbatimModuleSyntax`)

### Error Handling

Extend `DomainError` from `@ifc-viewer/core`:

```typescript
import { DomainError } from "@ifc-viewer/core"

export class SessionNotFoundError extends DomainError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`, "SESSION_NOT_FOUND", 404)
    this.name = "SessionNotFoundError"
  }
}
```

### Logging

Use `@ifc-viewer/logger` for all server-side logging:

```typescript
import { createLogger } from "@ifc-viewer/logger"

const log = createLogger("server")
log.info("Server started", { port: 3000 })
log.error("Request failed", { error, requestId })

const dbLog = log.child("database")  // Creates "server:database" namespace
```

Logs output to console (colored) and `.data/logs/app.YYYY-MM-DD.log` (plain text).

### React Patterns

- Function components with hooks; context providers for shared state
- Tailwind CSS with `cn()` utility from `@ifc-viewer/ui`
- Use `React.ComponentProps<"element">` for extending HTML element props

```typescript
const ViewerContext = createContext<ViewerContextValue | undefined>(undefined)

export function useViewer() {
  const context = useContext(ViewerContext)
  if (!context) throw new Error("useViewer must be used within ViewerProvider")
  return context
}
```

### API Routes (Elysia)

Factory functions with dependency injection and Zod validation:

```typescript
export function filesRoutes(ctx: Context) {
  return new Elysia({ prefix: "/api/workspaces/:id/files" })
    .get("/", async ({ params, query }) => {
      return controller.list(params.id, query.path)
    }, {
      params: z.object({ id: z.string() }),
      query: ListFilesQuery,
      response: { 200: ListFilesResponse },
      detail: { summary: "List files", tags: ["Files"], operationId: "listFiles" },
    })
}
```

### Package Structure

```
packages/{name}/
  src/
    index.ts          # Barrel exports (public API)
    types.ts          # Type definitions
    *.ts              # Implementation files
  tests/
    *.test.ts         # Test files
  package.json
  tsconfig.json
```

### Barrel Exports

Only export what consumers need:
```typescript
// Public API
export { createLogger, flushLogs, closeLogs } from "./logger.ts"
export type { Logger, LogLevel } from "./types.ts"
```

## Environment

- Bun auto-loads `.env` files (no dotenv needed)
- Copy `.env.example` to `.env` for local development
- Environment variables: `LOG_LEVEL`, `LOG_DIR`, `DATABASE_URL`, `PORT`, etc.

## Linting

No ESLint/Prettier configured. Follow TypeScript strict mode and match existing code patterns.
