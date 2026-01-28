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
│   │       │           WebSocket Server               │                  │   │
│   │       │  ┌─────────────────────────────────┐     │                  │   │
│   │       │  │  Room Management + Presence     │     │                  │   │
│   │       │  └─────────────────────────────────┘     │                  │   │
│   │       │         │              ▲                 │                  │   │
│   │       │         │   Subscribe  │  Publish        │                  │   │
│   │       │         ▼              │                 │                  │   │
│   └───────┼─────────┼──────────────┼─────────────────┼──────────────────┘   │
│           │         │              │                 │                      │
│           ▼         ▼              │                 ▼                      │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                              Redis                                  │   │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │   │
│   │  │  BullMQ Queues  │  │    Pub/Sub      │  │    Presence     │     │   │
│   │  │  - doc-process  │  │  - doc:{id}     │  │  - room keys    │     │   │
│   │  │  - embedding    │  │                 │  │    with TTL     │     │   │
│   │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │   │
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
| WebSockets | express-ws or ws |
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

Handles real-time collaboration features.

| Feature | How it works |
|---------|--------------|
| **Room management** | Clients join rooms by documentId; server tracks connections per room |
| **Event broadcasting** | Subscribes to Redis pub/sub; forwards events to clients in matching rooms |
| **Presence** | Tracks who is viewing each document; broadcasts cursor positions |

### 3.3 Redis

Single Redis instance serving multiple purposes via namespacing:

| Purpose | Redis Feature | Key Pattern |
|---------|---------------|-------------|
| Document processing queue | BullMQ | `bull:document-processing:*` |
| Embedding generation queue | BullMQ | `bull:embedding:*` |
| Real-time events | Pub/Sub | Channels: `doc:{documentId}` |
| Presence tracking | Key-Value + TTL | `presence:{documentId}:{userId}` |

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

## 4. Key Data Flows

### 4.1 Document Upload Flow

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

### 4.2 Real-Time Annotation Flow

```
┌──────────┐  1. POST /annotations    ┌──────────┐
│ Client A │ ──────────────────────▶  │   API    │
│ (author) │                          │          │
└──────────┘                          │  2. Write to DB
                                      │  3. Publish to Redis
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

### 4.3 Download Flow

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

## 5. Annotation Anchoring (Hybrid Approach)

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

## 6. Database Schema Overview

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      users      │       │    documents    │       │   annotations   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id visibleKey   │       │ id              │       │ id              │
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

## 7. Why This Architecture

| Decision | Reasoning |
|----------|-----------|
| **Monolith + Workers** | Simple to deploy, fast iteration for small team. Workers are separate processes but same codebase. Can extract to microservices later if needed. |
| **Single Redis instance** | One Redis handles queues (BullMQ), pub/sub (real-time), and presence. Avoids premature complexity. Namespacing keeps concerns separate. |
| **Async document processing** | Keeps API responses fast. Processing failures don't break document creation. Jobs are retryable. |
| **Presigned URLs** | Frontend uploads directly to S3, offloading bandwidth from backend. Same pattern for downloads. |
| **pgvector (not separate vector DB)** | Single database for relational data and vectors. Simpler ops, transactional consistency. Good enough for MVP scale. Migrate to dedicated vector DB only if needed. |
| **WebSocket + Redis pub/sub** | Enables real-time updates across multiple API server instances. Redis acts as the message bus. |
| **Hybrid anchors** | Coordinates work universally (even for scanned docs). Text/context stored when available for search and fuzzy re-anchoring. |

---

## 8. Processing Status Lifecycle

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

## 9. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Auth | JWT tokens validated on every request via middleware |
| Document access | Permission check: user must be owner OR member |
| S3 key as capability | Only returned to authorized users; presigned URLs expire |
| User input | Validate with Zod; sanitize before DB writes |
| Secrets | Environment variables, not in code |

---

## 10. Deployment Shape (MVP)

For the MVP, deploy as:

- **1 API process** — Express server (can run multiple behind load balancer)
- **1 Worker process** — BullMQ workers for document processing and embeddings
- **1 Redis instance** — Queues + pub/sub + presence
- **1 PostgreSQL instance** — All relational data + pgvector
- **1 S3 bucket** — Document storage (or MinIO for local dev)

All components can run in Docker via docker-compose for local development.

---

## 11. Future Considerations

| When | Consider |
|------|----------|
| High worker load | Scale workers horizontally (add more processes) |
| Vector search at scale | Migrate to dedicated vector DB (Pinecone, Qdrant, Weaviate) |
| Team growth | Extract services along clear boundaries (e.g., separate auth service) |
| Global users | CDN for S3, consider edge deployment for API |
| Complex permissions | Add roles to DocumentMember (VIEWER, COMMENTER, EDITOR) |

---

## 12. Current Implementation Status

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
