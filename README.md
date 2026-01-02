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

# Start development servers
bun run dev

# Or run individually
bun run dev:server    # Server on port 3000
bun run dev:web       # Web frontend
```

## Project Structure

```
apps/
  server/             # Elysia server (HTTP + WebSocket)
  web/                # React + Vite frontend

packages/
  core/               # Domain entities, services, ports
  interface/          # DTOs and HTTP controllers
  infrastructure/     # Database, storage, compute adapters
  ifc-viewer/         # 3D viewer (Three.js + web-ifc)
  sdk/                # Type-safe API client
  ui/                 # Shared UI components
```

## Architecture

This project follows **Clean Architecture** principles with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        apps/server                          │
│                     (Elysia routes)                         │
└─────────────────────────┬───────────────────────────────────┘
                          │ uses
┌─────────────────────────▼───────────────────────────────────┐
│                   packages/interface                         │
│              (DTOs, Controllers, Presenters)                 │
└─────────────────────────┬───────────────────────────────────┘
                          │ uses
┌─────────────────────────▼───────────────────────────────────┐
│                     packages/core                            │
│         (Domain Entities, Services, Port Interfaces)         │
└─────────────────────────┬───────────────────────────────────┘
                          │ implemented by
┌─────────────────────────▼───────────────────────────────────┐
│                 packages/infrastructure                      │
│           (Database, Storage, Compute Adapters)              │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer              | Package          | Responsibility                                          |
| ------------------ | ---------------- | ------------------------------------------------------- |
| **Domain**         | `core`           | Entities, value objects, domain errors, port interfaces |
| **Application**    | `core`           | Services that orchestrate use cases                     |
| **Interface**      | `interface`      | DTOs (Zod schemas), HTTP controllers                    |
| **Infrastructure** | `infrastructure` | Database, storage, compute implementations              |
| **Presentation**   | `server`         | HTTP routes, WebSocket handlers                         |

### Key Concepts

- **Ports & Adapters**: Core defines interfaces (ports), infrastructure implements them (adapters)
- **Dependency Inversion**: Core has no dependencies on infrastructure
- **DTOs**: Zod schemas for request/response validation, framework-agnostic
- **Controllers**: Business logic handlers that return `HttpResult<T>` types

## Scripts

```bash
# Development
bun run dev              # Start server + web
bun run dev:server       # Server only (port 3000)
bun run dev:web          # Web frontend only

# Build & Typecheck
bun run build            # Build all packages
bun run typecheck        # Type check all packages

# Database
bun run db:start         # Start Postgres via Docker
bun run db:stop          # Stop Postgres

# SDK
bun run generate:sdk     # Generate SDK from OpenAPI
```

## Environment Variables

All configuration is done via a single `.env` file at the repository root. Copy `.env.example` to get started:

```bash
cp .env.example .env
```

Key variables:

| Variable                 | Required | Description                                     |
| ------------------------ | -------- | ----------------------------------------------- |
| `ANTHROPIC_API_KEY`      | Yes      | Anthropic API key for AI features               |
| `DATABASE_URL`           | No       | Postgres connection string (defaults to SQLite) |
| `STORAGE_LOCAL_BASE_DIR` | No       | Storage directory (defaults to `.data/storage`) |
| `PORT`                   | No       | Server port (defaults to `3000`)                |

See `.env.example` for all available options.

## License

MIT
