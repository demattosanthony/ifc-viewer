# AGENTS.md - Coding Agent Guidelines

Guidelines for AI coding agents operating in this repository.

## Project Overview

Monorepo for an IFC (Industry Foundation Classes) viewer platform with AI agent integration.

```
apps/
  server/           # Elysia server - HTTP + WebSocket (port 3000)
  web/              # React + Vite frontend
packages/
  core/             # Domain entities, services, and port interfaces
  interface/        # DTOs and HTTP controllers
  infrastructure/   # Database, storage, and compute implementations
  ifc-viewer/       # IFC 3D viewer components (Three.js + web-ifc)
  realtime/         # SSE client/server utilities
  sdk/              # Type-safe API client
  ui/               # Shared UI components (shadcn/ui style)
```

## Package Manager: Bun

**CRITICAL: Use Bun exclusively.** Never use Node.js, npm, pnpm, yarn, or vite CLI.

```bash
bun install             # Install deps (not npm/yarn/pnpm)
bun <file.ts>           # Run TypeScript (not node/ts-node)
bunx <package>          # Run binaries (not npx)
```

Prefer Bun APIs: `Bun.file()` over fs, `Bun.$\`cmd\`` over execa, `bun:sqlite` over better-sqlite3.

## Commands

```bash
bun run dev                                    # Start server + web
bun run dev:server                             # Server only (port 3000)
bun run dev:web                                # Web frontend only
bun run build                                  # Build all packages
bun run typecheck                              # Type check all packages
bun --filter=@ifc-viewer/server run typecheck  # Single package typecheck
bun run generate:sdk                           # Generate SDK from OpenAPI
bun run db:start                               # Start Postgres via Docker
bun run db:stop                                # Stop Postgres
```

## Testing

Uses Bun's built-in test runner (`bun:test`).

```bash
bun test                                       # All tests
bun test packages/storage/tests/base.test.ts   # Single file
bun test packages/storage/tests/               # Directory
bun test --test-name-pattern "handles string"  # Pattern match
```

Test structure: `import { describe, test, expect } from "bun:test"`

## Code Style

### Naming Conventions

| Type             | Convention       | Example                          |
| ---------------- | ---------------- | -------------------------------- |
| Files            | kebab-case       | `file-tools.ts`, `use-sse.ts`    |
| Functions        | camelCase        | `createAgent`, `toBytes`         |
| Classes          | PascalCase       | `BimAgent`, `DomainError`        |
| Interfaces/Types | PascalCase       | `StorageProvider`, `AgentConfig` |
| Constants        | UPPER_SNAKE_CASE | `BIM_IDE_SYSTEM_PROMPT`          |
| React hooks      | `use` prefix     | `useSSE`, `useViewer`            |

### Import Order

1. External packages
2. Internal workspace packages (`@ifc-viewer/*`)
3. Relative imports
4. Use `import type` for type-only imports

### TypeScript

- Strict mode enabled; specify return types for public functions
- Use `interface` for object shapes/contracts, `type` for unions/aliases
- Use Zod schemas with type inference: `type Project = z.infer<typeof ProjectSchema>`
- Namespace pattern for grouping: `Project.CreateInput`, `Project.UpdateInput`

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

// In routes, handle with isDomainError
if (isDomainError(error)) {
  set.status = error.statusCode
  return { error: error.message }
}
```

### React Patterns

- Function components only; context providers for shared state
- Tailwind CSS with `cn()` utility; `class-variance-authority` for variants
- Use `React.ComponentProps<"element">` for prop types

```typescript
function Button({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, className }))} {...props} />
}
```

Context pattern: create with null default, throw in hook if missing.

### API Routes (Elysia)

Factory functions with context injection:

```typescript
export function filesRoutes(ctx: Context) {
  return new Elysia({ prefix: "/api/workspaces/:id/files" })
    .get("/", async ({ params, query }) => {
      const computer = ctx.getCompute(params.id)
      return computer.files.list(query.path ?? ".")
    }, {
      params: t.Object({ id: t.String() }),
      query: t.Object({ path: t.Optional(t.String()) }),
    })
}
```

### Module Structure

```
packages/{name}/
  src/
    index.ts          # Barrel exports
    types.ts          # Type definitions
  tests/*.test.ts
  package.json, tsconfig.json
```

### Barrel Exports

Grouped exports with type-only separation:

```typescript
export { ProjectSchema, createProject } from "./domain/entities/project"
export type { Project, ProjectRepository } from "./domain"
export { DomainError, isDomainError } from "./domain/errors"
```

## Environment

- Bun auto-loads `.env` files (no dotenv needed)
- Copy `.env.example` to `.env` for local development

## Linting

No ESLint/Prettier configured. Follow TypeScript strict mode and existing patterns.
