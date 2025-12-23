# File Storage Abstraction Plan

## Executive Summary

This plan introduces a **StorageProvider** abstraction layer that can plug into the existing Computer/FileSystem architecture or be used directly by the API. The design supports multiple backends (local filesystem, Bun S3, memory) while maintaining excellent developer experience for local development.

---

## Current State Analysis

### How Files Flow Today

```
Frontend                           API                              Computer
   │                                │                                   │
   ├─ FileReader.readAsDataURL() ──►│                                   │
   │  (file → base64)               │                                   │
   │                                │                                   │
   ├─ POST /files/content ─────────►├─ Buffer.from(base64) ────────────►│
   │  { content: base64 }           │  → Uint8Array                     │
   │                                │                                   │
   │                                │  computer.files.write(path, bytes)│
   │                                │                                   │
   │◄─ GET /files/content ──────────┤◄─ computer.files.read(path) ──────┤
   │   { content: base64 }          │   → base64 encode                 │
   │                                │                                   │
   └─ atob() → Uint8Array           │                                   │
```

### Problems with Current Approach

1. **Memory inefficiency**: Base64 encoding adds 33% overhead, entire file in memory
2. **No streaming**: Large IFC files (100MB+) must be fully loaded
3. **Tightly coupled**: Storage is embedded in LocalFileSystem
4. **No direct upload/download**: All data proxied through API
5. **No cloud-ready path**: Can't easily switch to S3/R2 for production

---

## Proposed Architecture

### Core Design: Two-Layer Abstraction

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
│                   (API Routes, Frontend, etc.)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────────┐               ┌─────────────────────┐
│     FileSystem      │               │   StorageProvider   │
│  (hierarchical ops) │               │   (blob/key-value)  │
│                     │               │                     │
│  - list, mkdir      │               │  - get, put, delete │
│  - stat, copy, move │               │  - exists, list     │
│  - read, write ─────┼──────────────►│  - presign, stream  │
└─────────────────────┘               └─────────────────────┘
          │                                       │
          │                    ┌──────────────────┼──────────────────┐
          │                    ▼                  ▼                  ▼
          │           ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
          │           │    Local     │   │    Bun S3    │   │   Memory     │
          │           │   Storage    │   │   Storage    │   │   Storage    │
          │           └──────────────┘   └──────────────┘   └──────────────┘
          │
          ▼
┌─────────────────────┐
│   LocalFileSystem   │  (still uses direct fs for directory ops)
└─────────────────────┘
```

### Why Two Layers?

1. **FileSystem** handles hierarchical operations (directories, paths, metadata)
2. **StorageProvider** handles blob storage (content, streaming, URLs)
3. FileSystem can optionally delegate file content to StorageProvider
4. API can use StorageProvider directly for uploads/downloads
5. Each layer has a single responsibility

---

## StorageProvider Interface

```typescript
// packages/computer/src/storage/types.ts

export interface StorageProvider {
  readonly type: string;

  // Core operations
  get(key: string): Promise<StorageObject | null>;
  put(key: string, data: StorageInput, options?: PutOptions): Promise<StorageResult>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;

  // Listing (optional - not all providers support)
  list?(prefix: string, options?: ListOptions): AsyncIterable<StorageEntry>;

  // Streaming (for large files)
  getStream(key: string): Promise<ReadableStream<Uint8Array> | null>;
  putStream(key: string, stream: ReadableStream<Uint8Array>, options?: PutOptions): Promise<StorageResult>;

  // Direct URLs (S3 presigned, local file:// or data:// URLs)
  getUrl(key: string, options?: UrlOptions): Promise<string | null>;
  getUploadUrl?(key: string, options?: UploadUrlOptions): Promise<UploadCredentials | null>;

  // Lifecycle
  dispose?(): Promise<void>;
}

// Input types - flexible data input
export type StorageInput =
  | string
  | Uint8Array
  | ArrayBuffer
  | Blob
  | ReadableStream<Uint8Array>;

// Object returned from get()
export interface StorageObject {
  data: Uint8Array;
  metadata: StorageMetadata;

  // Convenience methods
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  stream(): ReadableStream<Uint8Array>;
}

export interface StorageMetadata {
  key: string;
  size: number;
  contentType?: string;
  etag?: string;
  lastModified?: Date;
  customMetadata?: Record<string, string>;
}

export interface StorageEntry {
  key: string;
  size: number;
  lastModified?: Date;
}

export interface PutOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  // For multipart uploads
  partSize?: number;
}

export interface ListOptions {
  maxKeys?: number;
  startAfter?: string;
  delimiter?: string;
}

export interface UrlOptions {
  expiresIn?: number;  // seconds
  download?: boolean;  // Content-Disposition: attachment
  filename?: string;
}

export interface UploadUrlOptions {
  expiresIn?: number;
  contentType?: string;
  maxSize?: number;
}

export interface UploadCredentials {
  url: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
  fields?: Record<string, string>;  // For POST multipart
}

export interface StorageResult {
  key: string;
  size: number;
  etag?: string;
}
```

---

## Provider Implementations

### 1. LocalStorageProvider

For local development - uses filesystem with optional base64 data URL support.

```typescript
// packages/computer/src/storage/providers/local.ts

export interface LocalStorageConfig {
  baseDir: string;
  // For getUrl() - return file:// URLs (requires proper CORS) or data: URLs
  urlMode?: 'file' | 'data' | 'none';
}

export class LocalStorageProvider implements StorageProvider {
  readonly type = 'local';

  constructor(private config: LocalStorageConfig) {}

  async get(key: string): Promise<StorageObject | null> {
    const path = this.resolvePath(key);
    const file = Bun.file(path);

    if (!await file.exists()) return null;

    const data = new Uint8Array(await file.arrayBuffer());
    return new LocalStorageObject(key, data, file);
  }

  async put(key: string, data: StorageInput, options?: PutOptions): Promise<StorageResult> {
    const path = this.resolvePath(key);
    await this.ensureDir(path);

    const bytes = await this.toBytes(data);
    await Bun.write(path, bytes);

    const stat = await Bun.file(path).stat();
    return { key, size: stat.size };
  }

  async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const path = this.resolvePath(key);
    const file = Bun.file(path);
    if (!await file.exists()) return null;
    return file.stream();
  }

  async getUrl(key: string, options?: UrlOptions): Promise<string | null> {
    const path = this.resolvePath(key);
    const file = Bun.file(path);
    if (!await file.exists()) return null;

    if (this.config.urlMode === 'file') {
      return `file://${path}`;
    }

    if (this.config.urlMode === 'data') {
      const data = await file.arrayBuffer();
      const base64 = Buffer.from(data).toString('base64');
      const mime = file.type || 'application/octet-stream';
      return `data:${mime};base64,${base64}`;
    }

    return null;
  }

  // For local, we don't support direct upload URLs
  async getUploadUrl(): Promise<null> {
    return null;
  }

  async *list(prefix: string): AsyncIterable<StorageEntry> {
    // Walk directory and yield matching files
  }
}
```

### 2. S3StorageProvider

For production - uses Bun's native S3 client.

```typescript
// packages/computer/src/storage/providers/s3.ts

import { S3Client, type S3File } from 'bun';

export interface S3StorageConfig {
  accessKeyId?: string;      // Falls back to env
  secretAccessKey?: string;  // Falls back to env
  bucket: string;
  endpoint?: string;         // For R2, MinIO, etc.
  region?: string;
  prefix?: string;           // Key prefix for namespacing
}

export class S3StorageProvider implements StorageProvider {
  readonly type = 's3';
  private client: S3Client;
  private prefix: string;

  constructor(private config: S3StorageConfig) {
    this.client = new S3Client({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      bucket: config.bucket,
      endpoint: config.endpoint,
      region: config.region,
    });
    this.prefix = config.prefix || '';
  }

  private key(key: string): string {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  async get(key: string): Promise<StorageObject | null> {
    try {
      const file = this.client.file(this.key(key));
      const data = await file.bytes();
      return new S3StorageObject(key, data, file);
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  async put(key: string, data: StorageInput, options?: PutOptions): Promise<StorageResult> {
    const file = this.client.file(this.key(key));
    const bytes = await this.toBytes(data);

    await file.write(bytes, {
      type: options?.contentType,
    });

    return { key, size: bytes.byteLength };
  }

  async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    try {
      const file = this.client.file(this.key(key));
      return file.stream();
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  async getUrl(key: string, options?: UrlOptions): Promise<string | null> {
    const file = this.client.file(this.key(key));

    // Bun S3 presign is synchronous!
    return file.presign({
      expiresIn: options?.expiresIn || 3600,
      method: 'GET',
    });
  }

  async getUploadUrl(key: string, options?: UploadUrlOptions): Promise<UploadCredentials | null> {
    const file = this.client.file(this.key(key));

    const url = file.presign({
      expiresIn: options?.expiresIn || 3600,
      method: 'PUT',
    });

    return {
      url,
      method: 'PUT',
      headers: options?.contentType
        ? { 'Content-Type': options.contentType }
        : undefined,
    };
  }

  async *list(prefix: string): AsyncIterable<StorageEntry> {
    // Use S3 ListObjectsV2 API
  }
}
```

### 3. MemoryStorageProvider

For testing and ephemeral use cases.

```typescript
// packages/computer/src/storage/providers/memory.ts

export class MemoryStorageProvider implements StorageProvider {
  readonly type = 'memory';
  private store = new Map<string, { data: Uint8Array; metadata: StorageMetadata }>();

  async get(key: string): Promise<StorageObject | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    return new MemoryStorageObject(entry.data, entry.metadata);
  }

  async put(key: string, data: StorageInput): Promise<StorageResult> {
    const bytes = await this.toBytes(data);
    this.store.set(key, {
      data: bytes,
      metadata: { key, size: bytes.byteLength, lastModified: new Date() },
    });
    return { key, size: bytes.byteLength };
  }

  async getUrl(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    const base64 = Buffer.from(entry.data).toString('base64');
    return `data:application/octet-stream;base64,${base64}`;
  }

  // etc.
}
```

---

## Integration Options

### Option A: Storage as Separate Concern (Recommended)

FileSystem remains unchanged, StorageProvider is used directly by API for file transfers.

```typescript
// API route for file downloads
export const downloadFile = route
  .get()
  .params(z.object({ id: z.string() }))
  .query(z.object({ path: z.string() }))
  .handle(async (ctx) => {
    const session = sessionManager.getSession(ctx.params.id);
    const storage = session.storage; // StorageProvider

    // Try presigned URL first (S3)
    const url = await storage.getUrl(ctx.query.path);
    if (url && !url.startsWith('data:')) {
      return ctx.redirect(url, 302);
    }

    // Stream the file
    const stream = await storage.getStream(ctx.query.path);
    if (!stream) {
      return ctx.json({ error: 'Not found' }, 404);
    }

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${basename(ctx.query.path)}"`,
      },
    });
  });

// API route for presigned upload
export const getUploadUrl = route
  .post()
  .params(z.object({ id: z.string() }))
  .body(z.object({ path: z.string(), contentType: z.string().optional() }))
  .handle(async (ctx) => {
    const session = sessionManager.getSession(ctx.params.id);
    const storage = session.storage;

    const creds = await storage.getUploadUrl(ctx.body.path, {
      contentType: ctx.body.contentType,
      expiresIn: 300,
    });

    if (!creds) {
      // Fall back to proxied upload
      return ctx.json({ mode: 'proxy' });
    }

    return ctx.json({ mode: 'direct', ...creds });
  });
```

### Option B: FileSystem Wraps Storage

FileSystem delegates read/write to StorageProvider internally.

```typescript
export class StorageBackedFileSystem implements FileSystem {
  constructor(
    private storage: StorageProvider,
    private metadataStore: MetadataStore, // For directories, stat info
  ) {}

  async read(path: string, options?: ReadOptions): Promise<FileContent> {
    const obj = await this.storage.get(path);
    if (!obj) throw new Error('File not found');

    if (options?.encoding === 'binary') {
      return { type: 'binary', content: obj.data };
    }
    return { type: 'text', content: await obj.text() };
  }

  async write(path: string, content: string | Uint8Array): Promise<void> {
    await this.storage.put(path, content);
    await this.metadataStore.touch(path);
  }

  // mkdir, list, stat, etc. use metadataStore
}
```

### Recommendation: Option A (Separate Concern)

- Cleaner separation of concerns
- FileSystem still useful for local providers (shell needs real files)
- Storage can be used independently
- Easier to add features like deduplication, caching

---

## Session & Computer Integration

### Enhanced Session Type

```typescript
interface Session {
  id: string;
  computer: Computer;
  storage: StorageProvider;  // New!
  createdAt: number;
}

// Session manager creates both
function createSession(config: SessionConfig): Session {
  const storage = createStorageProvider(config.storage);
  const computer = createComputer(config.computer);

  return {
    id: generateId(),
    computer,
    storage,
    createdAt: Date.now(),
  };
}
```

### StorageProvider Factory

```typescript
// packages/computer/src/storage/create.ts

export type StorageConfig =
  | { type: 'local'; baseDir: string; urlMode?: 'file' | 'data' | 'none' }
  | { type: 's3'; bucket: string; prefix?: string; endpoint?: string }
  | { type: 'memory' };

export function createStorageProvider(config: StorageConfig): StorageProvider {
  switch (config.type) {
    case 'local':
      return new LocalStorageProvider(config);
    case 's3':
      return new S3StorageProvider(config);
    case 'memory':
      return new MemoryStorageProvider();
    default:
      throw new Error(`Unknown storage type: ${(config as any).type}`);
  }
}
```

---

## Frontend Changes

### Direct Upload with Presigned URLs

```typescript
// hooks/use-file-operations.ts

async function uploadFile(file: File, targetPath: string) {
  // 1. Request upload credentials
  const credsResponse = await api.sessions.storage.getUploadUrl({
    id: sessionId,
    path: targetPath,
    contentType: file.type,
  });

  if (credsResponse.mode === 'direct') {
    // 2a. Upload directly to storage (S3)
    await fetch(credsResponse.url, {
      method: credsResponse.method,
      headers: credsResponse.headers,
      body: file,
    });
  } else {
    // 2b. Fall back to proxied upload (local dev)
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', targetPath);

    await fetch(`/api/sessions/${sessionId}/files/upload`, {
      method: 'POST',
      body: formData,
    });
  }

  onRefresh(dirname(targetPath));
}
```

### Streaming Downloads

```typescript
// For large IFC files, stream directly
async function loadModelFromStorage(path: string) {
  const response = await fetch(`/api/sessions/${sessionId}/files/download?path=${path}`);

  // API returns redirect to presigned URL (S3) or streams directly
  const buffer = await response.arrayBuffer();
  loadModel(buffer, basename(path));
}
```

---

## File Structure

```
packages/computer/
├── src/
│   ├── index.ts                    # Export everything
│   ├── types.ts                    # Computer, FileSystem types
│   ├── create.ts                   # Computer factory
│   │
│   ├── storage/
│   │   ├── index.ts               # Export storage
│   │   ├── types.ts               # StorageProvider interface
│   │   ├── create.ts              # Storage factory
│   │   ├── base.ts                # Base class with shared utils
│   │   │
│   │   └── providers/
│   │       ├── local.ts           # LocalStorageProvider
│   │       ├── s3.ts              # S3StorageProvider
│   │       └── memory.ts          # MemoryStorageProvider
│   │
│   └── providers/
│       └── local/                  # Existing local computer
│           ├── computer.ts
│           ├── filesystem.ts
│           └── shell.ts
│
└── tests/
    ├── local-computer.test.ts
    └── storage/
        ├── local.test.ts
        ├── s3.test.ts
        └── memory.test.ts
```

---

## Environment Configuration

```bash
# .env.local (local development)
STORAGE_TYPE=local
STORAGE_LOCAL_BASE_DIR=/tmp/ifc-viewer-storage

# .env.production (S3/R2)
STORAGE_TYPE=s3
STORAGE_S3_BUCKET=ifc-viewer-files
STORAGE_S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
```

---

## Implementation Phases

### Phase 1: Core Storage Abstraction
1. Create `StorageProvider` interface and types
2. Implement `LocalStorageProvider`
3. Implement `MemoryStorageProvider` (for tests)
4. Add factory function and exports
5. Write comprehensive tests

### Phase 2: S3 Integration
1. Implement `S3StorageProvider` using Bun's S3 client
2. Add presigned URL support
3. Test with MinIO locally
4. Test with Cloudflare R2 / AWS S3

### Phase 3: API Integration
1. Add storage to Session type
2. Create new streaming download route
3. Create presigned upload URL route
4. Maintain backward compatibility with existing routes

### Phase 4: Frontend Updates
1. Update upload to use presigned URLs when available
2. Update downloads to handle redirects/streaming
3. Add upload progress indicators
4. Handle large file scenarios

### Phase 5: Advanced Features (Future)
1. Content-addressed storage (hash-based deduplication)
2. Caching layer (memory cache + storage)
3. Compression for storage efficiency
4. CDN integration

---

## Benefits

1. **Memory Efficient**: Stream large files instead of buffering
2. **Cloud Ready**: Easy switch to S3/R2 for production
3. **Direct Transfers**: Presigned URLs bypass API for uploads/downloads
4. **Local Dev Friendly**: Works great without cloud setup
5. **Testable**: Memory provider for fast tests
6. **Extensible**: Add new providers (GCS, Azure Blob, etc.)
7. **Backward Compatible**: Existing FileSystem API unchanged

---

## Open Questions

1. **Hybrid approach?** Should FileSystem use Storage for file content in all cases, or only for large files?

2. **Session storage isolation**: Prefix per session, or shared storage with access control?

3. **Cleanup strategy**: When using S3, how to garbage collect orphaned files?

4. **Caching layer**: Should we add an LRU cache in front of S3 for frequently accessed files?

---

## Summary

This design introduces a clean `StorageProvider` abstraction that:

- **Separates concerns**: File content storage vs filesystem operations
- **Supports multiple backends**: Local, S3, Memory (and extensible)
- **Enables streaming**: Critical for large IFC files
- **Provides presigned URLs**: Direct browser ↔ storage transfers
- **Maintains compatibility**: Existing Computer/FileSystem unchanged
- **Optimizes for Bun**: Uses Bun.file, Bun S3 client natively

The implementation is phased to deliver value incrementally while building toward a production-ready storage layer.
