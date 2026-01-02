# @ifc-viewer/core

Core domain logic for the IFC Viewer platform.

## Architecture

```
src/
  domain/           # Business entities (schemas, types, use cases)
    project.ts      # Project namespace
    workspace.ts    # Workspace namespace
    conversation.ts # Conversation namespace
    message.ts      # Message namespace
  contracts/        # Infrastructure contracts (interfaces)
    database.ts     # Database namespace (repository interfaces)
    storage.ts      # Storage namespace (blob storage interface)
    compute.ts      # Compute namespace (sandbox interface)
  context.ts        # Dependency injection
  errors.ts         # Domain error types
  index.ts          # Public exports
```

## Domain Model

```
Project (persistent)
  └── Workspace (ephemeral compute environment)
        └── Conversation (AI chat session)
              └── Message (chat message)
```

## Usage

### Domain Namespaces

Each domain entity is a TypeScript namespace containing schemas, types, and use cases:

```typescript
import { Project, Workspace, Conversation, Message } from "@ifc-viewer/core"

// Schemas (Zod) - for validation
Project.Entity.parse(data)
Project.CreateInput.parse(input)

// Types - inferred from schemas
type P = Project.Entity
type CreateInput = Project.CreateInput

// Use cases - business logic
const project = await Project.create(ctx, { id: "my-project" })
const projects = await Project.list(ctx)
await Project.remove(ctx, "my-project")
```

### Infrastructure Contracts

Contracts define what external systems must implement. Each contract is a TypeScript namespace:

```typescript
import type { Database, Storage, Compute } from "@ifc-viewer/core"

// Database contract
const db: Database.Provider = {
  projects: projectRepository,
  workspaces: workspaceRepository,
  conversations: conversationRepository,
  messages: messageRepository,
  dispose: async () => { ... },
}

// Storage contract
const storage: Storage.Provider = {
  type: "local",
  get: async (key) => { ... },
  put: async (key, data) => { ... },
  delete: async (key) => { ... },
  // ...
}

// Compute contract
const compute: Compute.Provider = {
  id: "computer-123",
  workingDirectory: "/workspace",
  files: fileSystem,
  shell: shell,
  createTerminal: async () => { ... },
  // ...
}
```

#### Contract Namespaces

**Database** - Repository interfaces for domain entities:
- `Database.Provider` - Main database interface
- `Database.ProjectRepository` - Project CRUD operations
- `Database.WorkspaceRepository` - Workspace CRUD operations
- `Database.ConversationRepository` - Conversation operations
- `Database.MessageRepository` - Message operations

**Storage** - Blob/object storage:
- `Storage.Provider` - Main storage interface
- `Storage.Object` - Stored object with metadata
- `Storage.Metadata` - Object metadata
- `Storage.Entry` - Directory listing entry
- `Storage.Input` - Acceptable input types (string, Uint8Array, Blob, etc.)
- `Storage.PutOptions`, `Storage.ListOptions`, `Storage.UrlOptions`

**Compute** - Sandboxed compute environment:
- `Compute.Provider` - Main compute interface
- `Compute.FileSystem` - File operations (read, write, list, mkdir, etc.)
- `Compute.Shell` - Shell/terminal operations
- `Compute.TerminalSession` - Interactive terminal session
- `Compute.FileEntry`, `Compute.FileStat`, `Compute.FileContent`
- `Compute.Config`, `Compute.TerminalOptions`

### Context (Dependency Injection)

Wire dependencies together using the context:

```typescript
import { createContext, type Context } from "@ifc-viewer/core"
import type { Database, Storage, Compute } from "@ifc-viewer/core"

const ctx = createContext({
  db: database,      // Database.Provider
  storage: storage,  // Storage.Provider
  compute: compute,  // Compute.Provider
})

// Use in domain functions
const project = await Project.create(ctx, { id: "my-project" })

// Cleanup
await ctx.dispose()
```

### Errors

Domain-specific errors with HTTP status codes:

```typescript
import { NotFoundError, ValidationError, DomainError, isDomainError } from "@ifc-viewer/core"

try {
  await Project.get(ctx, "non-existent")
} catch (error) {
  if (isDomainError(error)) {
    console.log(error.code)       // "NOT_FOUND"
    console.log(error.statusCode) // 404
    console.log(error.message)    // "Project 'non-existent' not found"
  }
}
```

## Design Principles

1. **Namespace Pattern** - Each domain entity and contract is a namespace containing related types and functions
2. **Schema-First** - Zod schemas are the source of truth for domain types
3. **Pure Domain** - Domain logic has no infrastructure dependencies (uses Context)
4. **Contract-Based** - Infrastructure is abstracted behind namespace interfaces
5. **Functional** - Prefer functions over classes
