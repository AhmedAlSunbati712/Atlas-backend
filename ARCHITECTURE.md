# Atlas Backend — Architecture

This document describes the finalized architecture for the Atlas collaborative annotation platform.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Atlas Backend                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         Express API Server                          │   │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│   │  │   Auth   │  │ Document │  │  Upload  │  │Annotation│            │   │
│   │  │  Routes  │  │  Routes  │  │  Routes  │  │  Routes  │            │   │
│   │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │   │
│   │       │             │             │             │                   │   │
│   │       ▼             ▼             ▼             ▼                   │   │
│   │  ┌──────────────────────────────────────────────────────┐          │   │
│   │  │                    Services Layer                     │          │   │
│   │  └──────────────────────────────────────────────────────┘          │   │
│   │       │                                          │                  │   │
│   │       │  DB writes                    Queue jobs │                  │   │
│   │       ▼                                          ▼                  │   │
│   └───────┼──────────────────────────────────────────┼──────────────────┘   │
│           │                                          │                      │
│   ┌───────┼──────────────────────────────────────────┼──────────────────┐   │
│   │       │     WebSocket Server (same port /ws)     │                  │   │
│   │       │  ┌─────────────────────────────────┐     │                  │   │
│   │       │  │  Room Management (in-memory Map)│     │                  │   │
│   │       │  └─────────────────────────────────┘     │                  │   │
│   │       │         │              ▲                 │                  │   │
│   │       │         │   Subscribe  │  Publish        │                  │   │
│   │       │         ▼              │                 │                  │   │
│   └───────┼─────────┼──────────────┼─────────────────┼──────────────────┘   │
│           │         │              │                 │                      │
│           ▼         ▼              │                 ▼                      │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                              Redis                                  │   │
│   │  ┌─────────────────┐  ┌─────────────────┐                          │   │
│   │  │  BullMQ Queues  │  │    Pub/Sub      │                          │   │
│   │  │  - doc-process  │  │  - doc:{id}     │                          │   │
│   │  │  - embedding    │  │  (multi-server) │                          │   │
│   │  └─────────────────┘  └─────────────────┘                          │   │
│   └───────────────────────────────────┬─────────────────────────────────┘   │
│                                       │                                     │
│   ┌───────────────────────────────────┼─────────────────────────────────┐   │
│   │                            Workers │                                │   │
│   │  ┌─────────────────┐  ┌───────────┴───────┐                        │   │
│   │  │ Document Worker │  │ Embedding Worker  │                        │   │
│   │  │ - Download S3   │  │ - Generate vectors│                        │   │
│   │  │ - Extract text  │  │ - Store in DB     │                        │   │
│   │  │ - Queue embed   │  │                   │                        │   │
│   │  └────────┬────────┘  └─────────┬─────────┘                        │   │
│   │           │                     │                                   │   │
│   └───────────┼─────────────────────┼───────────────────────────────────┘   │
│               │                     │                                       │
│               ▼                     ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                           PostgreSQL                                │   │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │   │
│   │  │  users   │  │documents │  │annotations│  │ pgvector (embed) │    │   │
│   │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                            S3 / MinIO                               │   │
│   │                     (Document blob storage)                         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                          External APIs                              │   │
│   │                    (OpenAI Embeddings / LLM)                        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (LTS) + TypeScript |
| API Framework | Express |
| Database | PostgreSQL 16 + pgvector extension |
| ORM | Prisma |
| Object Storage | S3 / MinIO (local dev) |
| Cache + Queue + Pub/Sub | Redis (single instance) |
| Job Queue | BullMQ |
| WebSockets | ws (shares HTTP server) |
| Auth | JWT (jsonwebtoken) |
| Embeddings | OpenAI text-embedding-3-small |
| PDF Parsing | pdf-parse or pdfjs-dist |

---

## 3. Components

### 3.1 Express API Server

The main HTTP server handling all REST endpoints.

| Module | Responsibility |
|--------|----------------|
| **Auth** | Sign-up, login, JWT issuance and validation |
| **Upload** | Generate presigned S3 URLs for upload/download |
| **Document** | CRUD for document metadata, permission checks |
| **Annotation** | CRUD for annotations, threading, layers |
| **Search** | Full-text and semantic search queries |

### 3.2 WebSocket Server

Handles real-time collaboration for **group layer annotations only**.

| Aspect | Details |
|--------|---------|
| **Port** | Same as Express (shares the HTTP server via `/ws` path) |
| **Room tracking** | In-memory `Map<docId, Map<userId, WebSocket>>` |
| **When used** | Only when user is viewing group layer annotations |
| **Presence** | Tracked via WebSocket connections (connected = present, disconnected = gone) |

**Note:** Personal layer annotations don't need WebSockets — use regular HTTP (react-query/axios).

### 3.3 Redis

Single Redis instance serving two main purposes:

| Purpose | Redis Feature | Key Pattern |
|---------|---------------|-------------|
| Document processing queue | BullMQ | `bull:document-processing:*` |
| Embedding generation queue | BullMQ | `bull:embedding:*` |
| Real-time events (multi-server) | Pub/Sub | Channels: `doc:{documentId}` |

**Note on Pub/Sub:** Redis pub/sub is only needed when running **multiple API server instances**. For a single server, the in-memory room Map is sufficient. We include pub/sub for future scalability.

### 3.4 Workers

Separate Node.js processes that consume jobs from BullMQ queues.

| Worker | Responsibilities |
|--------|------------------|
| **Document Worker** | Download file from S3, extract text (PDF/OCR), update DB, queue embedding job |
| **Embedding Worker** | Generate vector embeddings via OpenAI API, store in PostgreSQL (pgvector) |

### 3.5 PostgreSQL

Primary data store with pgvector extension for semantic search.

| Table | Purpose |
|-------|---------|
| `users` | User accounts, auth |
| `documents` | Document metadata, s3Key, textContent, processingStatus |
| `document_members` | Many-to-many: which users have access to which documents |
| `annotations` | Highlights, comments, notes, links, tags with hybrid anchors |

### 3.6 S3 / MinIO

Object storage for document files (PDFs, images, code files).

- **MinIO** in development (S3-compatible, runs in Docker)
- **AWS S3** or compatible (R2, etc.) in production
- Frontend uploads/downloads directly via presigned URLs

---

## 4. WebSocket: When and How

### 4.1 When to use WebSocket

| Annotation Layer | Transport | Why |
|------------------|-----------|-----|
| **Personal** | HTTP only (axios/react-query) | Only you can see them. No real-time sync needed. |
| **Group** | HTTP + WebSocket | Others can add/edit. Need real-time updates. |

### 4.2 WebSocket Connection Flow

```
┌──────────┐                                    ┌──────────────────────────┐
│ Frontend │                                    │  Backend (Express + WS)  │
└────┬─────┘                                    └────────────┬─────────────┘
     │                                                       │
     │  1. User toggles to group layer                       │
     │                                                       │
     │  2. new WebSocket("ws://localhost:3000/ws")          │
     │ ─────────────────────────────────────────────────────▶│
     │     HTTP Upgrade request                              │
     │                                                       │
     │  ◀───────────────────────────────────────────────────│
     │     101 Switching Protocols                           │
     │                                                       │
     │  3. ws.send({ action: "join", documentId, userId })  │
     │ ─────────────────────────────────────────────────────▶│
     │                                                       │  4. Add to room Map
     │                                                       │
     │  ... connection stays open ...                        │
     │                                                       │
     │  5. Another user creates annotation (HTTP POST)       │
     │                                                       │  6. API writes to DB
     │                                                       │  7. API publishes to Redis
     │                                                       │     (or directly to room if single server)
     │                                                       │
     │  ◀───────────────────────────────────────────────────│  8. WS server forwards
     │     { type: "annotation.created", annotation }        │
     │                                                       │
     │  9. Frontend updates UI                               │
     │                                                       │
     │  10. User toggles back to personal layer              │
     │                                                       │
     │  ws.close()                                           │
     │ ─────────────────────────────────────────────────────▶│  11. Remove from room Map
     │                                                       │
```

### 4.4 Presence Tracking

Presence is tracked **via WebSocket connections**, not Redis keys:

| Event | Action |
|-------|--------|
| Client connects + joins room | They're present (in the room Map) |
| Client disconnects | They're gone (removed from Map) |
| Get who's in a room | Iterate the Map for that docId |

To notify others of presence changes, publish events via the same pub/sub channel:

```typescript
// On join
redis.publish(`doc:${docId}`, JSON.stringify({
  type: 'presence.joined',
  user: { id: userId, name: userName }
}));

// On leave
redis.publish(`doc:${docId}`, JSON.stringify({
  type: 'presence.left',
  userId
}));
```

---

## 5. Key Data Flows

### 5.1 Document Upload Flow

```
┌──────────┐  1. POST /upload         ┌──────────┐
│  Client  │ ──────────────────────▶  │   API    │
│          │  { filename, mimetype }  │          │
│          │                          │          │
│          │  ◀────────────────────── │          │
│          │  2. { uploadUrl, s3Key } │          │
│          │                          └──────────┘
│          │
│          │  3. PUT uploadUrl (file bytes)
│          │ ──────────────────────────────────▶  S3
│          │
│          │  4. POST /documents
│          │ ──────────────────────▶  ┌──────────┐
│          │  { s3Key, title, ... }   │   API    │
└──────────┘                          │          │
                                      │  5. Create document (PENDING)
                                      │  6. Queue processing job
                                      └────┬─────┘
                                           │
                                           ▼
                                      ┌──────────┐
                                      │  Redis   │
                                      │  Queue   │
                                      └────┬─────┘
                                           │
                                           ▼
                                      ┌──────────┐
                                      │  Worker  │
                                      │          │
                                      │  7. Download from S3
                                      │  8. Extract text
                                      │  9. Queue embedding job
                                      │  10. Update document (READY)
                                      └──────────┘
```

### 5.2 Real-Time Annotation Flow (Group Layer)

```
┌──────────┐  1. POST /annotations    ┌──────────┐
│ Client A │ ──────────────────────▶  │   API    │
│ (author) │                          │          │
└──────────┘                          │  2. Write to DB
                                      │  3. Publish to Redis (or room Map)
                                      └────┬─────┘
                                           │
                                           ▼
                                      ┌──────────┐
                                      │  Redis   │
                                      │  Pub/Sub │
                                      └────┬─────┘
                                           │
                                           ▼
                                      ┌──────────┐
                                      │    WS    │
                                      │  Server  │
                                      │          │
                                      │  4. Forward to room
                                      └────┬─────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
              ┌──────────┐          ┌──────────┐          ┌──────────┐
              │ Client B │          │ Client C │          │ Client D │
              │ (viewer) │          │ (viewer) │          │ (viewer) │
              │          │          │          │          │          │
              │ 5. Update│          │ 5. Update│          │ 5. Update│
              │    UI    │          │    UI    │          │    UI    │
              └──────────┘          └──────────┘          └──────────┘
```

### 5.3 Download Flow

```
┌──────────┐  1. GET /documents       ┌──────────┐
│  Client  │ ──────────────────────▶  │   API    │
│          │                          │          │
│          │  ◀────────────────────── │  2. Permission check
│          │  [{ id, s3Key, ... }]    │     (owner OR member)
│          │                          └──────────┘
│          │
│          │  3. GET /upload/download?s3Key=...
│          │ ──────────────────────▶  ┌──────────┐
│          │                          │   API    │
│          │  ◀────────────────────── │          │
│          │  4. { url: presignedUrl }│          │
│          │                          └──────────┘
│          │
│          │  5. GET presignedUrl
│          │ ──────────────────────────────────▶  S3
│          │  ◀──────────────────────────────────
│          │  6. File bytes
└──────────┘
```

---

## 6. Annotation Anchoring (Hybrid Approach)

Annotations use a hybrid anchor strategy depending on document type:

| Document Type | Primary Anchor | Secondary Data |
|---------------|----------------|----------------|
| PDF / Images | Coordinates (page, x, y, width, height as %) | Extracted/OCR text for search |
| Code files | Line numbers (startLine, endLine) | Snippet for fuzzy re-matching |
| Plain text | Character offsets + context | — |

Anchor schema (stored as JSON):

```typescript
// PDF / Image anchor
{
  type: "coords",
  page: 1,
  x: 10.5,      // % from left
  y: 25.0,      // % from top
  width: 30.0,  // % of page width
  height: 2.5,  // % of page height
  text?: {
    selected: "highlighted text",
    before: "context before...",
    after: "...context after"
  }
}

// Code anchor
{
  type: "code",
  startLine: 42,
  endLine: 50,
  startCol: 0,
  endCol: 80,
  snippet: "function foo() { ... }"
}

// Text anchor
{
  type: "text",
  startOffset: 1234,
  endOffset: 1300,
  selected: "selected text",
  before: "context before...",
  after: "...context after"
}
```

---

## 7. Database Schema Overview

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      users      │       │    documents    │       │   annotations   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ email           │◀──────│ ownerId (FK)    │──────▶│ documentId (FK) │
│ passwordHash    │       │ title           │       │ userId (FK)     │
│ name            │       │ type            │       │ type            │
│ avatarUrl       │       │ mimeType        │       │ layer           │
│ createdAt       │       │ size            │       │ anchor (JSON)   │
│ updatedAt       │       │ s3Key           │       │ color           │
└────────┬────────┘       │ textContent     │       │ content         │
         │                │ processingStatus│       │ parentId (FK)   │
         │                │ embedding       │       │ resolved        │
         │                │ createdAt       │       │ metadata (JSON) │
         │                │ updatedAt       │       │ createdAt       │
         │                └────────┬────────┘       │ updatedAt       │
         │                         │                └─────────────────┘
         │                         │
         │    ┌────────────────────┘
         │    │
         ▼    ▼
┌─────────────────────┐
│  document_members   │
├─────────────────────┤
│ id                  │
│ documentId (FK)     │
│ userId (FK)         │
│ joinedAt            │
│                     │
│ @@unique(docId,     │
│          userId)    │
└─────────────────────┘
```

---

## 8. Why This Architecture

| Decision | Reasoning |
|----------|-----------|
| **Monolith + Workers** | Simple to deploy, fast iteration for small team. Workers are separate processes but same codebase. Can extract to microservices later if needed. |
| **Single Redis instance** | One Redis handles queues (BullMQ) and pub/sub (real-time). Avoids premature complexity. |
| **WebSocket only for group layer** | Personal annotations don't need real-time. Reduces complexity and connections. |
| **Presence via connections** | No Redis keys/TTL needed. WebSocket connection = present. Simpler than explicit presence tracking. |
| **Redis pub/sub optional for MVP** | Only needed for multi-server. Single server can use in-memory room Map directly. |
| **Async document processing** | Keeps API responses fast. Processing failures don't break document creation. Jobs are retryable. |
| **Presigned URLs** | Frontend uploads directly to S3, offloading bandwidth from backend. Same pattern for downloads. |
| **pgvector (not separate vector DB)** | Single database for relational data and vectors. Simpler ops, transactional consistency. Good enough for MVP scale. |
| **Hybrid anchors** | Coordinates work universally (even for scanned docs). Text/context stored when available for search and fuzzy re-anchoring. |

---

## 9. Processing Status Lifecycle

```
PENDING ──▶ PROCESSING ──▶ READY
                │
                ▼
             FAILED
```

| Status | Meaning |
|--------|---------|
| PENDING | Document created, waiting for worker |
| PROCESSING | Worker picked up the job |
| READY | Text extracted, embedding generated |
| FAILED | Processing error (see processingError field) |

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Auth | JWT tokens validated on every request via middleware |
| Document access | Permission check: user must be owner OR member |
| S3 key as capability | Only returned to authorized users; presigned URLs expire |
| User input | Validate with Zod; sanitize before DB writes |
| Secrets | Environment variables, not in code |

---

## 11. Deployment Shape (MVP)

For the MVP, deploy as:

- **1 API process** — Express server + WebSocket server (same port)
- **1 Worker process** — BullMQ workers for document processing and embeddings
- **1 Redis instance** — Queues + pub/sub (pub/sub optional for single server)
- **1 PostgreSQL instance** — All relational data + pgvector
- **1 S3 bucket** — Document storage (or MinIO for local dev)

All components can run in Docker via docker-compose for local development.

**Scaling note:** When you need multiple API servers, Redis pub/sub becomes essential for broadcasting events across instances.

---

## 12. Future Considerations

| When | Consider |
|------|----------|
| High worker load | Scale workers horizontally (add more processes) |
| Multiple API servers | Enable Redis pub/sub for cross-instance real-time |
| Vector search at scale | Migrate to dedicated vector DB (Pinecone, Qdrant, Weaviate) |
| Team growth | Extract services along clear boundaries (e.g., separate auth service) |
| Global users | CDN for S3, consider edge deployment for API |
| Complex permissions | Add roles to DocumentMember (VIEWER, COMMENTER, EDITOR) |

---

## 13. Current Implementation Status

| Component | Status |
|-----------|--------|
| Project scaffold | ✓ Done |
| Docker-compose (Postgres, Redis, MinIO) | ✓ Done |
| Prisma schema | ✓ Done |
| Auth (signup, login, JWT middleware) | ✓ Done |
| User service + routes | ✓ Done |
| Upload service (presigned URLs) | ✓ Done |
| Document service + routes | ✓ Done |
| Annotation service + routes | Pending |
| WebSocket server | Pending |
| Workers (document processing, embeddings) | Pending |
| Search (full-text, semantic) | Pending |
