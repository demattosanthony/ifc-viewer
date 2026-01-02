# IFC Viewer

A modern IFC (Industry Foundation Classes) viewer platform with AI agent integration for BIM workflows.

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Backend:** [Elysia](https://elysiajs.com)
- **Frontend:** React + Vite + Tailwind CSS
- **3D Viewer:** Three.js + web-ifc
- **AI:** Anthropic Claude SDK

## Getting Started

```bash
# Install dependencies
bun install

# Copy environment variables
cp .env.example .env

# Start Postgres (required for persistence)
bun run db:start

# Start development servers (API + Web)
bun run dev

# Or run individually
bun run dev:api    # API on port 3000
bun run dev:web    # Web frontend
```

## Project Structure

```
apps/
  api/              # Elysia backend server (port 3000)
  web/              # React + Vite frontend
packages/
  agent/            # AI agent with tool capabilities
  core/             # Domain entities, errors, and port interfaces
  ifc-viewer/       # IFC 3D viewer components (Three.js + web-ifc)
  infrastructure/   # Database, storage, and compute implementations
  realtime/         # SSE client/server utilities
  sdk/              # Type-safe API client (Eden treaty)
  ui/               # Shared UI components (shadcn/ui style)
```

## Scripts

```bash
# Development
bun run dev                # Start API + web servers
bun run dev:api            # API server only
bun run dev:web            # Web frontend only

# Build & Typecheck
bun run build              # Build all packages
bun run typecheck          # Type check all packages

# Database
bun run db:start           # Start Postgres via Docker
bun run db:stop            # Stop Postgres
bun run db:logs            # View Postgres logs

# SDK Generation
bun run generate:sdk       # Generate SDK from OpenAPI
bun run fetch:openapi      # Fetch OpenAPI spec from running server

# Testing
bun test                   # Run all tests
bun test path/to/file.ts   # Run single test file

# UI Components
bun run ui:add             # Add shadcn components to apps/web
```

## Architecture

### Core Package (`@ifc-viewer/core`)

Domain-driven design with entities, value objects, and port interfaces:

- **Entities:** `Project`, `Workspace`, `Conversation`, `Message`
- **Errors:** `DomainError` base class with `NotFoundError`, `ValidationError`, etc.
- **Ports:** `Database`, `Storage`, `Compute` interfaces for dependency inversion

### Infrastructure Package (`@ifc-viewer/infrastructure`)

Implements core ports with concrete adapters:

- **Database:** SQLite, Postgres, and in-memory implementations
- **Storage:** Local filesystem, S3, and in-memory implementations
- **Compute:** Local shell execution for agent tools

### Agent Package (`@ifc-viewer/agent`)

AI agent powered by Anthropic Claude with tool capabilities:

- File operations (read, write, list, search)
- Shell command execution
- IFC model analysis

## Environment Variables

See `.env.example` for all available options:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Database (defaults to SQLite)
DATABASE_PROVIDER=sqlite  # sqlite | postgres | memory
DATABASE_URL=./data/ifc-viewer.db

# Storage (defaults to local)
STORAGE_PROVIDER=local  # local | s3 | memory
STORAGE_PATH=./data/storage
```

## License

MIT
