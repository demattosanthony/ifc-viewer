# AGENTS.md - Coding Agent Guidelines

Guidelines for AI coding agents operating in this repository.

## Project Overview

Monorepo for an IFC (Industry Foundation Classes) viewer platform with AI agent integration.

```
apps/server/        # Elysia server - HTTP + WebSocket (port 3000)
apps/web/           # React + Vite frontend
packages/core/      # Domain entities, services, and port interfaces
packages/interface/ # DTOs and HTTP controllers
packages/infrastructure/ # Database, storage, compute implementations
packages/ifc-viewer/    # IFC 3D viewer (Three.js + web-ifc)
packages/sdk/       # Type-safe API client
packages/ui/        # Shared UI components (shadcn/ui)
```

## Package Manager: Bun

**CRITICAL: Use Bun exclusively.** Never use npm, pnpm, yarn, or vite CLI.

```bash
bun install             # Install deps
bun <file.ts>           # Run TypeScript
bunx <package>          # Run binaries
```

Prefer Bun APIs: `Bun.file()` over fs, `Bun.$\`cmd\`` over execa.

## Commands

```bash
bun run dev                                    # Start server + web
bun run dev:server                             # Server only (port 3000)
bun run dev:web                                # Web frontend only
bun run build                                  # Build all packages
bun run typecheck                              # Type check all
bun --filter=@ifc-viewer/server run typecheck  # Single package
bun run generate:sdk                           # Generate SDK from OpenAPI
bun run db:start                               # Start Postgres (Docker)
```

## Testing

Uses Bun's built-in test runner (`bun:test`).

```bash
bun test                                          # All tests
bun test packages/core/tests/domain/              # Directory
bun test packages/core/tests/domain/slug.test.ts  # Single file
bun test --test-name-pattern "creates project"    # Pattern match
```

Test structure:
```typescript
import { describe, test, expect } from "bun:test"

describe("Feature", () => {
  test("does something", () => {
    expect(result).toBe(expected)
  })
})
```

## Code Style

### Naming Conventions

| Type             | Convention       | Example                       |
| ---------------- | ---------------- | ----------------------------- |
| Files            | kebab-case       | `file-tools.ts`, `use-sse.ts` |
| Functions        | camelCase        | `createAgent`, `toBytes`      |
| Classes/Types    | PascalCase       | `BimAgent`, `StorageProvider` |
| Constants        | UPPER_SNAKE_CASE | `BIM_IDE_SYSTEM_PROMPT`       |
| React hooks      | `use` prefix     | `useSSE`, `useViewer`         |

### Import Order

1. External packages (`react`, `elysia`, `three`)
2. Internal workspace packages (`@ifc-viewer/*`)
3. Relative imports (`./`, `../`)
4. Use `import type` for type-only imports

### TypeScript

- Strict mode with `noUncheckedIndexedAccess`
- Specify return types for public functions
- Use `interface` for object shapes, `type` for unions/aliases
- Use Zod schemas with inference: `type Project = z.infer<typeof ProjectSchema>`

### Error Handling

Extend `DomainError` from `@ifc-viewer/core`:

```typescript
import { DomainError, isDomainError } from "@ifc-viewer/core"

export class SessionNotFoundError extends DomainError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`, "SESSION_NOT_FOUND", 404)
    this.name = "SessionNotFoundError"
  }
}
```

### React Patterns

- Function components; context providers for shared state
- Tailwind CSS with `cn()` utility; `class-variance-authority` for variants
- Use `React.ComponentProps<"element">` for prop types
- Context: create with undefined default, throw in hook if missing

```typescript
const ViewerContext = createContext<ViewerContextValue | undefined>(undefined)

export const useViewer = () => {
  const context = useContext(ViewerContext)
  if (!context) throw new Error("useViewer must be used within ViewerProvider")
  return context
}
```

### API Routes (Elysia)

Factory functions with context injection and Zod validation:

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

### Module Structure

```
packages/{name}/
  src/index.ts      # Barrel exports
  tests/*.test.ts
  package.json, tsconfig.json
```

### Barrel Exports

```typescript
export { ProjectSchema, createProject } from "./domain/entities/project"
export type { Project, ProjectRepository } from "./domain"
export { DomainError, isDomainError } from "./domain/errors"
```

## Environment

- Bun auto-loads `.env` files (no dotenv needed)
- Copy `.env.example` to `.env` for local development
- Server runs on port 3000 by default

## Linting

No ESLint/Prettier configured. Follow TypeScript strict mode and existing patterns.
