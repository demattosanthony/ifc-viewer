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

# Start development servers (API + Web)
bun run dev

# Or run individually
bun run dev:api    # API on port 3000
bun run dev:web    # Web frontend
```

## Project Structure

```
apps/
  api/              # Elysia backend server
  web/              # React + Vite frontend
packages/
  agent/            # AI agent with tool capabilities
  compute/          # Sandbox/Computer abstractions
  core/             # Domain entities and interfaces
  database/         # Database implementations
  ifc-viewer/       # IFC 3D viewer components
  realtime/         # SSE/WebSocket utilities
  sdk/              # Type-safe API client
  storage/          # Blob storage abstractions
  ui/               # Shared UI components
```

## Scripts

```bash
bun run build          # Build all packages
bun run typecheck      # Type check all packages
bun run generate:sdk   # Generate SDK from OpenAPI
bun test               # Run tests
```

## License

MIT
