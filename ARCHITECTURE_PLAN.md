# IFC Viewer Architecture Refactoring Plan

## Executive Summary

This plan refactors the IFC Viewer monorepo from a "bunbox" framework-based playground into a clean architecture with:

- **Elysia API server** with auto-generated OpenAPI/Swagger documentation
- **Eden treaty** for type-safe client SDK generation
- **Vite + React** frontend
- **SSE** for agent streaming, **WebSocket** only for bidirectional terminal
- Clean separation of domain entities, database abstractions, and realtime utilities

## Target Architecture

```
ifc-viewer/
├── apps/
│   ├── api/                     # Elysia backend API
│   └── web/                     # Vite + React frontend
│
├── packages/
│   ├── core/                    # Domain entities & interfaces (zero deps)
│   ├── database/                # Database implementations (memory → Postgres)
│   ├── storage/                 # Blob storage (existing, minor refactor)
│   ├── compute/                 # Renamed from computer, add Sandbox abstraction
│   ├── agent/                   # AI agent (refactor to use Sandbox)
│   ├── viewer/                  # 3D IFC viewer (renamed from ifc-viewer)
│   ├── realtime/                # SSE + WebSocket abstraction
│   ├── sdk/                     # Auto-generated from Elysia (Eden treaty)
│   └── ui/                      # Shared UI components extracted from playground
```

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API Framework | **Elysia** | Bun-native, first-class OpenAPI via @elysiajs/swagger |
| Client SDK | **Eden Treaty** | Auto-generated type-safe client from Elysia types |
| Frontend | **Vite + React** | Fast HMR, battle-tested plugin ecosystem |
| Agent Streaming | **SSE** | One-way, simpler, auto-reconnect, HTTP/2 compatible |
| Terminal | **WebSocket** | Bidirectional required for user input + output |
| Database | **Memory → Postgres** | Start with memory provider, interface ready for Postgres |

---

## Phase 0: Preparation

### What to Preserve
- `packages/storage/` - Keep entirely, minimal refactor needed
- `packages/ifc-viewer/` - Keep entirely, just rename package to `@ifc-viewer/viewer`
- `packages/agent/src/` - Keep agent logic, refactor to use Sandbox interface
- `packages/computer/src/` - Keep providers, add Sandbox abstraction layer
- `apps/playground/shared/ui/` - Extract to `packages/ui/`
- `apps/playground/features/` - Migrate to `apps/web/src/features/`

### What to Delete (at end of migration)
- `apps/playground/` - After migration complete
- `apps/playground/.bunbox/` - Auto-generated bunbox files
- `apps/playground/bunbox.config.ts`

### Dependencies to Add

**apps/api (new):**
```json
{
  "dependencies": {
    "elysia": "^1.2.0",
    "@elysiajs/cors": "^1.2.0",
    "@elysiajs/swagger": "^1.2.0"
  }
}
```

**apps/web (new):**
```json
{
  "dependencies": {
    "@ifc-viewer/sdk": "workspace:*",
    "@ifc-viewer/ui": "workspace:*",
    "@ifc-viewer/realtime": "workspace:*",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router": "^7.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0"
  }
}
```

---

## Phase 1: Create @ifc-viewer/core

**Goal**: Define domain entities and repository interfaces with zero external dependencies.

### Files to Create

```
packages/core/
├── src/
│   ├── entities/
│   │   ├── session.ts
│   │   └── file-node.ts
│   ├── repositories/
│   │   └── session-repository.ts
│   ├── errors/
│   │   └── index.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Key Interfaces

```typescript
// entities/session.ts
export interface Session {
  id: string;
  workingDirectory: string;
  createdAt: Date;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateSessionInput {
  workingDirectory?: string;
  ttlMs?: number;
  metadata?: Record<string, unknown>;
}

export interface SessionWithResources extends Session {
  terminalIds: string[];
  hasAgentTerminal: boolean;
}
```

```typescript
// entities/file-node.ts
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modifiedAt: Date;
}

export interface FileContent {
  type: 'text' | 'binary';
  content: string; // base64 for binary
  path: string;
  size: number;
}
```

```typescript
// repositories/session-repository.ts
export interface SessionRepository {
  create(input: CreateSessionInput): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  findAll(): Promise<Session[]>;
  delete(id: string): Promise<void>;
  updateExpiry(id: string, expiresAt: Date): Promise<void>;

  // Terminal tracking
  addTerminal(sessionId: string, terminalId: string): Promise<void>;
  removeTerminal(sessionId: string, terminalId: string): Promise<void>;
  setAgentTerminal(sessionId: string, terminalId: string | null): Promise<void>;
  getWithResources(id: string): Promise<SessionWithResources | null>;
}
```

```typescript
// errors/index.ts
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class SessionNotFoundError extends DomainError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`, 'SESSION_NOT_FOUND', 404);
  }
}

export class FileNotFoundError extends DomainError {
  constructor(path: string) {
    super(`File not found: ${path}`, 'FILE_NOT_FOUND', 404);
  }
}
```

### Migration Steps
1. Create `packages/core/` directory structure
2. Define entity interfaces extracted from current `session-manager.ts`
3. Define repository interfaces
4. Define domain errors
5. Export all types from index

### Validation
- [ ] `bun run typecheck` passes in packages/core
- [ ] Types can be imported in other packages
- [ ] No external dependencies (check package.json)

---

## Phase 2: Create @ifc-viewer/database

**Goal**: Implement repository interfaces with memory provider, extracting session management logic.

### Files to Create

```
packages/database/
├── src/
│   ├── providers/
│   │   └── memory/
│   │       ├── session-repository.ts
│   │       └── index.ts
│   ├── factory.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Key Implementation

```typescript
// factory.ts
export interface DatabaseProvider {
  sessions: SessionRepository;
  dispose(): Promise<void>;
}

export type DatabaseConfig =
  | { type: 'memory'; workingDirectory: string; onSessionExpire?: (id: string) => Promise<void> }
  // Future: | { type: 'postgres'; connectionString: string }

export function createDatabase(config: DatabaseConfig): DatabaseProvider {
  if (config.type === 'memory') {
    const sessions = new MemorySessionRepository({
      defaultWorkingDirectory: config.workingDirectory,
      onExpire: config.onSessionExpire,
    });

    return {
      sessions,
      dispose: () => sessions.disposeAll(),
    };
  }

  throw new Error(`Unknown database type: ${(config as any).type}`);
}
```

### Migration Steps
1. Create `packages/database/` directory
2. Extract session storage logic from `apps/playground/shared/utils/session-manager.ts`
3. Implement `SessionRepository` interface with memory provider
4. Add factory function for creating database instances
5. Include timeout/expiry logic from current session-manager

### Validation
- [ ] Unit tests for `MemorySessionRepository`
- [ ] Session creation, lookup, deletion, expiry work
- [ ] Terminal tracking methods work correctly

---

## Phase 3: Refactor @ifc-viewer/compute

**Goal**: Rename from `computer` and add Sandbox abstraction layer.

### Files to Create/Modify

```
packages/compute/                 # Renamed from packages/computer
├── src/
│   ├── sandbox.ts               # NEW - Sandbox interface
│   ├── types.ts                 # Existing
│   ├── providers/
│   │   └── local/
│   │       ├── computer.ts      # Existing (was LocalComputer)
│   │       ├── sandbox.ts       # NEW - LocalSandbox implementation
│   │       ├── provider.ts      # NEW - SandboxProvider factory
│   │       └── index.ts
│   ├── create.ts                # NEW - createSandbox factory
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Key Interfaces

```typescript
// sandbox.ts
export interface Sandbox {
  readonly id: string;
  readonly workingDirectory: string;

  // Computer capabilities
  readonly computer: Computer;

  // Storage for file serving (URLs, streaming)
  readonly storage: StorageProvider;

  // Terminal management
  createTerminal(): Promise<TerminalSession>;
  getTerminal(id: string): TerminalSession | undefined;
  getAllTerminals(): TerminalSession[];
  disposeTerminal(id: string): Promise<void>;

  // Agent terminal (persistent for session)
  getOrCreateAgentTerminal(): Promise<TerminalSession>;

  // Lifecycle
  dispose(): Promise<void>;
}

export interface SandboxProvider {
  readonly type: string;
  create(config: SandboxConfig): Promise<Sandbox>;
}

export interface SandboxConfig {
  workingDirectory: string;
  environment?: Record<string, string>;
  storageUrlMode?: 'data' | 'file' | 'presigned';
}
```

### Migration Steps
1. Rename `packages/computer/` to `packages/compute/`
2. Update `package.json` name to `@ifc-viewer/compute`
3. Add `Sandbox` interface
4. Implement `LocalSandbox` wrapping existing `LocalComputer`
5. Create `SandboxProvider` factory pattern
6. Update exports - keep legacy exports for backwards compatibility during migration
7. Update all imports in other packages (`@ifc-viewer/computer` → `@ifc-viewer/compute`)

### Validation
- [ ] Existing computer tests still pass
- [ ] New sandbox can be created and disposed
- [ ] Terminal creation/disposal works through sandbox
- [ ] Storage is accessible through sandbox

---

## Phase 4: Create @ifc-viewer/realtime

**Goal**: Provide SSE and WebSocket utilities for both server and client.

### Files to Create

```
packages/realtime/
├── src/
│   ├── events/
│   │   ├── agent-events.ts      # Re-export from @ifc-viewer/agent
│   │   ├── terminal-events.ts   # Terminal WebSocket events
│   │   └── index.ts
│   ├── server/
│   │   ├── sse.ts               # SSE utilities for Elysia
│   │   └── index.ts
│   ├── client/
│   │   ├── use-sse.ts           # React hook for SSE
│   │   ├── use-websocket.ts     # React hook for WebSocket
│   │   └── index.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Key Utilities

```typescript
// server/sse.ts
export interface SSEContext {
  send(event: string, data: unknown): void;
  close(): void;
}

export function createSSEStream(
  onConnect: (ctx: SSEContext) => void | Promise<void>
): ReadableStream;

export function sseResponse(
  stream: ReadableStream,
  headers?: Record<string, string>
): Response;
```

```typescript
// client/use-sse.ts
export interface UseSSEOptions<T> {
  url: string;
  onEvent: (event: T) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  enabled?: boolean;
}

export function useSSE<T>(options: UseSSEOptions<T>): {
  isConnected: boolean;
  close: () => void;
};
```

```typescript
// client/use-websocket.ts
export interface UseWebSocketOptions<TReceive, TSend> {
  url: string;
  onMessage: (data: TReceive) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  enabled?: boolean;
  reconnect?: boolean;
}

export function useWebSocket<TReceive, TSend>(options: UseWebSocketOptions<TReceive, TSend>): {
  isConnected: boolean;
  send: (data: TSend) => void;
  close: () => void;
};
```

### Migration Steps
1. Create `packages/realtime/` directory
2. Create SSE server utilities for Elysia
3. Create terminal event types
4. Create React hooks for SSE and WebSocket
5. Re-export agent events for convenience
6. Ensure proper TypeScript configuration

### Validation
- [ ] SSE stream can be created and sends events
- [ ] useSSE hook connects and receives events
- [ ] useWebSocket hook connects, sends, and receives
- [ ] Event types are properly exported

---

## Phase 5: Create apps/api

**Goal**: Elysia backend with OpenAPI documentation migrating all existing API functionality.

### Files to Create

```
apps/api/
├── src/
│   ├── index.ts                 # Elysia app entry point
│   ├── context.ts               # App context (DB, sandboxes)
│   ├── routes/
│   │   ├── sessions.ts          # Session CRUD
│   │   ├── files.ts             # File operations
│   │   ├── agent.ts             # Agent chat (SSE)
│   │   └── terminal.ts          # Terminal (WebSocket)
│   └── middleware/
│       └── error-handler.ts
├── package.json
└── tsconfig.json
```

### Route Structure

| Route | Method | Description |
|-------|--------|-------------|
| `/api/sessions` | POST | Create session |
| `/api/sessions` | GET | List sessions |
| `/api/sessions/:id` | GET | Get session |
| `/api/sessions/:id` | DELETE | Delete session |
| `/api/sessions/:id/files` | GET | List files |
| `/api/sessions/:id/files/content` | GET | Read file |
| `/api/sessions/:id/files/content` | POST | Write file |
| `/api/sessions/:id/files` | DELETE | Delete file |
| `/api/sessions/:id/files/directory` | POST | Create directory |
| `/api/sessions/:id/agent/chat` | POST | Agent chat (SSE response) |
| `/ws/terminal` | WS | Terminal WebSocket |

### Key Implementation

```typescript
// index.ts
import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';

const app = new Elysia()
  .use(cors())
  .use(swagger({
    documentation: {
      info: {
        title: 'IFC Viewer API',
        version: '1.0.0',
      },
    },
  }))
  .decorate('ctx', ctx)
  .use(sessionsRoutes)
  .use(filesRoutes)
  .use(agentRoutes)
  .use(terminalRoutes)
  .listen(3000);

export type App = typeof app;
```

```typescript
// context.ts
export interface AppContext {
  db: DatabaseProvider;
  sandboxes: Map<string, Sandbox>;
  getSandbox(sessionId: string): Sandbox | undefined;
  createSandbox(sessionId: string): Promise<Sandbox>;
  disposeSandbox(sessionId: string): Promise<void>;
  dispose(): Promise<void>;
}
```

### Migration Steps
1. Create `apps/api/` directory
2. Set up Elysia with swagger and cors plugins
3. Create context with database and sandbox management
4. Migrate session routes from `apps/playground/app/api/sessions/`
5. Migrate file routes from `apps/playground/app/api/sessions/[id]/files/`
6. Create agent route with SSE streaming (convert from WebSocket)
7. Create terminal route with WebSocket
8. Add OpenAPI documentation to all routes
9. Export `App` type for SDK generation

### Validation
- [ ] `bun run dev` starts the API server on port 3000
- [ ] Swagger UI accessible at `/swagger`
- [ ] Session CRUD works
- [ ] File operations work
- [ ] Agent chat streams responses via SSE
- [ ] Terminal WebSocket connects and relays I/O

---

## Phase 6: Create @ifc-viewer/sdk

**Goal**: Auto-generate type-safe client from Elysia using Eden treaty.

### Files to Create

```
packages/sdk/
├── src/
│   ├── index.ts                 # Client factory
│   └── hooks.ts                 # React hooks
├── package.json
└── tsconfig.json
```

### Key Implementation

```typescript
// index.ts
import { treaty } from '@elysiajs/eden';
import type { App } from '@ifc-viewer/api';

export type { App };

export function createClient(baseUrl: string = '') {
  return treaty<App>(baseUrl);
}

export type ApiClient = ReturnType<typeof createClient>;
```

```typescript
// hooks.ts
import { useMemo } from 'react';
import { createClient, type ApiClient } from './index';

export function useApiClient(baseUrl?: string): ApiClient {
  return useMemo(() => createClient(baseUrl), [baseUrl]);
}
```

### Usage Example

```typescript
import { useApiClient } from '@ifc-viewer/sdk';

function MyComponent() {
  const api = useApiClient();

  // Fully typed!
  const createSession = async () => {
    const { data, error } = await api.api.sessions.post();
    if (data) {
      console.log(data.id);
    }
  };
}
```

### Migration Steps
1. Create `packages/sdk/` directory
2. Set up Eden treaty with API types
3. Create factory function for client creation
4. Add React hook for convenient usage
5. Export relevant types from core

### Validation
- [ ] SDK types match API routes
- [ ] Client can be created and used
- [ ] IntelliSense works for all endpoints
- [ ] Type errors appear for incorrect usage

---

## Phase 7: Create @ifc-viewer/ui

**Goal**: Extract shared UI components from playground.

### Files to Create

```
packages/ui/
├── src/
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── textarea.tsx
│   ├── separator.tsx
│   ├── skeleton.tsx
│   ├── alert-dialog.tsx
│   ├── popover.tsx
│   ├── tooltip.tsx
│   ├── sheet.tsx
│   ├── collapsible.tsx
│   ├── sidebar.tsx
│   ├── progress.tsx
│   ├── loader.tsx
│   ├── error-boundary.tsx
│   ├── chat-container.tsx
│   ├── prompt-input.tsx
│   ├── message.tsx
│   ├── avatar.tsx
│   ├── code-block.tsx
│   ├── markdown.tsx
│   ├── utils.ts                 # cn() function
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Migration Steps
1. Create `packages/ui/` directory
2. Copy all files from `apps/playground/shared/ui/`
3. Update imports to be relative within package
4. Export all components from index
5. Update apps/web to import from `@ifc-viewer/ui`

### Validation
- [ ] All UI components export correctly
- [ ] Components render in apps/web
- [ ] No duplicate UI code between packages

---

## Phase 8: Create apps/web

**Goal**: Vite + React frontend using SDK and migrated features.

### Files to Create

```
apps/web/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── pages/
│   │   └── Playground.tsx
│   ├── features/
│   │   ├── agent/
│   │   │   ├── context.tsx      # Convert WebSocket → SSE
│   │   │   ├── components/
│   │   │   │   ├── chat-panel.tsx
│   │   │   │   ├── message.tsx
│   │   │   │   └── tool.tsx
│   │   │   └── hooks/
│   │   │       └── use-agent-presence.ts
│   │   ├── editor/
│   │   │   ├── context.tsx
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── file-browser/
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── ifc-viewer/
│   │   │   └── components/
│   │   ├── terminal/
│   │   │   └── components/
│   │   │       └── terminal.tsx  # Use useWebSocket hook
│   │   └── layout/
│   │       └── main-content.tsx
│   ├── hooks/
│   │   ├── use-copy-to-clipboard.ts
│   │   └── use-mobile.ts
│   └── lib/
│       └── utils.ts
├── vite.config.ts
├── index.html
├── package.json
└── tsconfig.json
```

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
});
```

### Key Changes from Playground

1. **Agent Context**: Convert from WebSocket to SSE
   - Replace WebSocket connection with `useSSE` hook
   - Use SDK client for initial HTTP requests
   - Keep same message state management

2. **Terminal**: Use `useWebSocket` hook from realtime package
   - Keep xterm.js integration identical
   - Use typed events from `@ifc-viewer/realtime`

3. **File Browser**: Use SDK client
   - Replace fetch calls with `api.api.sessions[sessionId].files.*`
   - Benefit from type-safe responses

4. **Editor/Viewer**: Direct migration
   - No API changes needed
   - Just update import paths

### Migration Steps
1. Create `apps/web/` directory with Vite setup
2. Create `vite.config.ts` with proxy configuration
3. Create `index.html` entry point
4. Migrate features one by one in order:
   - `editor/` - Direct migration (no API calls)
   - `ifc-viewer/` - Direct migration
   - `file-browser/` - Update API calls to use SDK
   - `terminal/` - Use `useWebSocket` hook
   - `agent/` - Convert WebSocket to SSE
5. Create `pages/Playground.tsx` composing all features
6. Test each feature as migrated

### Validation
- [ ] `bun run dev` starts Vite dev server on port 5173
- [ ] Session creation works via SDK
- [ ] File browser shows files and allows CRUD
- [ ] Terminal connects via WebSocket and works
- [ ] Agent chat streams responses via SSE
- [ ] IFC viewer loads and displays models
- [ ] All keyboard shortcuts work

---

## Phase 9: Rename @ifc-viewer/viewer

**Goal**: Rename the IFC viewer package to follow `@ifc-viewer/*` convention.

### Changes Required

1. Rename directory: `packages/ifc-viewer/` → `packages/viewer/`
2. Update `package.json`:
   ```json
   {
     "name": "@ifc-viewer/viewer",
     ...
   }
   ```
3. Update all imports in `apps/web/`

### Migration Steps
1. Rename `packages/ifc-viewer/` to `packages/viewer/`
2. Update `package.json` name to `@ifc-viewer/viewer`
3. Search and replace imports: `ifc-viewer` → `@ifc-viewer/viewer`
4. Update workspace references

### Validation
- [ ] Package builds successfully
- [ ] Viewer works in apps/web

---

## Phase 10: Cleanup

**Goal**: Remove deprecated code and finalize structure.

### Delete
- `apps/playground/` - Entire directory
- Root bunbox configurations (if any)

### Update Root package.json

```json
{
  "name": "ifc-viewer-monorepo",
  "private": true,
  "scripts": {
    "dev": "bun run dev:api & bun run dev:web",
    "dev:api": "bun --filter @ifc-viewer/api run dev",
    "dev:web": "bun --filter @ifc-viewer/web run dev",
    "build": "bun run build:packages && bun run build:apps",
    "build:packages": "bun --filter '@ifc-viewer/*' run build",
    "build:apps": "bun --filter @ifc-viewer/api run build && bun --filter @ifc-viewer/web run build",
    "typecheck": "bun --filter '*' run typecheck",
    "test": "bun --filter '*' run test"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

### Final Directory Structure

```
ifc-viewer/
├── apps/
│   ├── api/                     # Elysia backend
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── context.ts
│   │   │   └── routes/
│   │   └── package.json
│   └── web/                     # Vite + React frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── pages/
│       │   └── features/
│       ├── vite.config.ts
│       └── package.json
│
├── packages/
│   ├── core/                    # Domain entities & interfaces
│   ├── database/                # Database implementations
│   ├── storage/                 # Blob storage
│   ├── compute/                 # Sandbox + Computer
│   ├── agent/                   # AI Agent
│   ├── viewer/                  # IFC Viewer
│   ├── realtime/                # SSE + WebSocket
│   ├── sdk/                     # Eden treaty client
│   └── ui/                      # Shared UI components
│
├── package.json
├── bun.lock
└── ARCHITECTURE_PLAN.md
```

### Cleanup Steps
1. Verify all functionality works in new apps
2. Delete `apps/playground/` entirely
3. Remove bunbox from root devDependencies
4. Update root scripts
5. Run `bun install` to clean up lockfile
6. Run full build to verify everything works
7. Update README.md with new structure

### Final Validation
- [ ] `bun install` completes without errors
- [ ] `bun run dev` starts both API and web
- [ ] `bun run build` builds all packages and apps
- [ ] `bun run typecheck` passes
- [ ] All functionality works:
  - [ ] Session management
  - [ ] File operations
  - [ ] Terminal
  - [ ] Agent chat
  - [ ] IFC viewer

---

## Appendix: Migration Reference

### Critical Files to Reference

| Current Location | Purpose | Migration Target |
|-----------------|---------|------------------|
| `apps/playground/shared/utils/session-manager.ts` | Session logic | `packages/database/src/providers/memory/` |
| `packages/computer/src/types.ts` | Computer interfaces | `packages/compute/src/types.ts` |
| `apps/playground/app/ws/agent/route.ts` | Agent WebSocket | `apps/api/src/routes/agent.ts` (SSE) |
| `apps/playground/features/agent/context.tsx` | Agent React context | `apps/web/src/features/agent/context.tsx` |
| `packages/agent/src/events.ts` | Event types | `packages/realtime/src/events/` |
| `apps/playground/shared/ui/*` | UI components | `packages/ui/src/` |

### Import Path Changes

| Old Import | New Import |
|-----------|------------|
| `@ifc-viewer/computer` | `@ifc-viewer/compute` |
| `ifc-viewer` | `@ifc-viewer/viewer` |
| `../../shared/ui/*` | `@ifc-viewer/ui` |
| Direct fetch calls | `@ifc-viewer/sdk` |

---

## Timeline Estimate

| Phase | Description | Complexity |
|-------|-------------|------------|
| 0 | Preparation | Low |
| 1 | @ifc-viewer/core | Low |
| 2 | @ifc-viewer/database | Medium |
| 3 | @ifc-viewer/compute | Medium |
| 4 | @ifc-viewer/realtime | Medium |
| 5 | apps/api | High |
| 6 | @ifc-viewer/sdk | Low |
| 7 | @ifc-viewer/ui | Low |
| 8 | apps/web | High |
| 9 | Rename viewer | Low |
| 10 | Cleanup | Low |

Phases 1-4 can potentially be parallelized as they don't depend on each other.
Phases 5-8 must be sequential as they depend on previous work.
