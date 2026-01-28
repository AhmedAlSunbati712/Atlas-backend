# Atlas Backend — Architecture

This document reasons from the [product specification](README.md) to a concrete backend architecture: required components, their responsibilities, and a recommended tech stack.

**Stack choices (locked in):** **Node.js**, **PostgreSQL**, **S3** (or S3-compatible object storage). See **§4** (tech stack), **§7** (Vector DB), **§8** (WebSockets), and **§9** (next steps).

---

## 1. Architecture rationale

### 1.1 From requirements to subsystems

The spec defines six main functional areas and strong non-functional constraints. Each area implies one or more backend components:

| Requirement area | Why it needs dedicated components |
|------------------|-----------------------------------|
| **Document management** | Uploads, versioning, and previews are I/O-heavy and need isolation from low-latency paths. Storing blobs (PDFs, images) is a different concern from metadata and permissions. |
| **Annotations** | Annotations are the core domain object: create/update/delete, anchoring, threads, reactions. They must be fast (<200ms), durable (“never lost”), and queryable by document, layer, and user. |
| **Collaboration** | Real-time propagation and presence need a stateful, connection-oriented layer (e.g. WebSockets) and possibly a pub/sub layer so multiple app instances can share events. |
| **Search & discovery** | Full-text over documents and annotations plus semantic search over embeddings require both keyword search and vector search, which map to different storage and indexing systems. |
| **Cross-document linking** | Links form a graph. Graph traversal (e.g. “annotations related to this one”) and graph visualization endpoints are easier to implement if the model and queries are explicit rather than buried in general CRUD. |
| **AI-assisted reading** | Summaries, explanations, and suggestions are CPU/API-heavy and async. They must not block core reads/writes. Failures must not affect annotation persistence. So AI runs in a separate async layer with queues and workers. |

The spec’s “Backend Services” list (auth, document, annotation, collaboration, search & graph) and “Async / AI Layer” (ingestion, embeddings, AI workers) align with this breakdown. The architecture keeps these as **logical components** that can be implemented as modules or services inside one process for the MVP, and split into separate services later if needed.

### 1.2 Data flow and boundaries

- **Synchronous path**: API → Auth → Document/Annotation/Collaboration/Search services → PostgreSQL (and object storage for document bytes). Optimized for latency and consistency.
- **Async path**: Upload/event triggers → Queue → Workers (ingestion, embeddings, AI) → Object storage, vector DB, and annotation store. Optimized for throughput and fault tolerance.
- **Real-time path**: Client ↔ WebSocket/SSE → collaboration service ↔ pub/sub (e.g. Redis) so all API instances see the same presence and annotation events.

Storing **documents** in object storage and **metadata + annotations** in a relational DB keeps blob handling separate from transactional, queryable data. **Embeddings** live in a vector store so semantic search stays scalable and doesn’t overload the main DB.

---

## 2. Components

### 2.1 Auth & permissions service

**Responsibilities**

- User identity (sign-up, login, sessions or tokens).
- Role-based access (e.g. viewer, commenter, owner) and enforcing who can read/write which documents and layers.
- Token/session validation for other backend components.

**Needs**

- User store (or integration with IdP).
- Permission checks on every document and annotation access.

**MVP**: Single component; can be a library or module used by the API rather than a separate microservice.

---

### 2.2 Document service

**Responsibilities**

- Accept uploads (PDF, text, code, images).
- Store files in object storage and metadata (owner, type, permissions, versions) in the DB.
- Serve document metadata and pre-signed or proxied URLs for download/preview.
- Optional: trigger ingestion (e.g. text extraction, page splits) for search and anchoring.

**Needs**

- Object storage (S3-compatible or similar).
- Relational store for document and version metadata.
- Idempotent handling of versions.

**MVP**: Upload, store, version metadata, and serve URLs; minimal preview generation if any.

---

### 2.3 Annotation service

**Responsibilities**

- CRUD for annotations (highlight, comment, inline note, link, tag).
- Threaded discussions, reactions, resolve/reopen.
- Anchoring: text (offset + context), code (file + line range), image (bounding box).
- Layer (personal / group / public) and visibility rules.
- Persistence and consistency so annotations are “never lost.”

**Needs**

- Relational DB with support for JSON (anchor payloads, metadata).
- Clear schema for annotations, threads, and links.
- Authorization integrated with the auth & permissions service.

**MVP**: Highlights, threaded comments, personal + group layers, and stable anchors for at least text/PDF.

---

### 2.4 Collaboration service

**Responsibilities**

- Real-time delivery of annotation create/update/delete and presence.
- Optional: activity feed, notifications (replies, mentions, links).
- Target: annotation updates visible in &lt;200ms.

**Needs**

- WebSockets or SSE.
- Pub/sub (e.g. Redis) so every API instance can publish and subscribe to room/channel-scoped events.
- Room membership and presence state.

**MVP**: Broadcast of annotation events per document or layer; presence optional. Last-write-wins is acceptable initially.

---

### 2.5 Search & graph service

**Responsibilities**

- **Search**: Full-text over documents and annotations; filters by user, layer, tag, document; semantic search via embeddings.
- **Graph**: Create and query links between annotations; relationship types; support for “related annotations” and graph visualization APIs.

**Needs**

- Full-text indexing (DB-native or dedicated engine).
- Vector store and embedding pipeline for semantic search.
- Graph model: links as first-class records; queries for paths, neighbourhoods, or suggested links.

**MVP**: Full-text search and basic filters; semantic search and graph APIs can be limited or stubbed.

---

### 2.6 Async / AI layer

**Workers**

- **Ingestion**: Post-upload, extract text, split into pages/chunks, optional normalization for anchors.
- **Embedding generation**: Turn text (documents, annotations) into vectors and write to the vector DB.
- **AI agents**: Summarize, explain, suggest links, answer questions; write results as annotations and cite sources.

**Needs**

- Job queue (e.g. Redis-based or cloud queue).
- Worker processes that pull jobs and call external AI APIs.
- Idempotency and retries so AI/embedding failures don’t corrupt data.
- Feature flags or toggles so AI being down doesn’t block core reads/writes.

**MVP**: One worker type for “explain/summarize” and a simple queue; embeddings can be added right after.

---

### 2.7 API gateway / orchestration

**Responsibilities**

- Single entrypoint: REST or GraphQL.
- Routing to auth, document, annotation, collaboration, search/graph.
- Rate limiting, request validation, and centralized error handling.

**MVP**: One API application that composes the components above as modules or in-process calls. Collaboration can be exposed via a WebSocket endpoint on the same app or a shared pub/sub backend.

---

## 3. Storage layout

| Concern | Store | Rationale |
|--------|--------|-----------|
| Users, roles, sessions | Relational DB | ACID, joins with permissions and ownership. |
| Documents metadata, versions | Relational DB | Versioning and permissions are relational. |
| Document blobs (PDF, images) | Object storage | Large, append-only, stream-friendly; cheaper at scale. |
| Annotations, threads, reactions, links | Relational DB | Strong consistency, relational queries, JSON for anchors. |
| Full-text index | PostgreSQL FTS or search engine | Good enough for MVP with PostgreSQL; can move to Elasticsearch/Meilisearch later. |
| Embeddings | Vector DB | Similarity search and scaling separate from transactional DB. |

---

## 4. Recommended tech stack

**Locked in:** **Node.js** (LTS), **PostgreSQL**, **S3** (or S3-compatible). The rest is chosen to fit that base and keep the MVP as one deployable app.

### 4.1 Runtime and API

- **Runtime**: **Node.js** (LTS) with **TypeScript**.
- **API**: **Fastify** — async, low latency, built-in schema validation, WebSocket support, and good OpenAPI story.

### 4.2 Auth

- **Strategy**: JWT access tokens + optional refresh tokens; or OAuth2/OIDC via an identity provider.
- **Libraries**: **Passport.js** + **jsonwebtoken**, or **Supabase Auth** / **Clerk** if you want to avoid custom auth code.
- **RBAC**: Implement in app logic and middleware; roles and resource ownership live in PostgreSQL.

### 4.3 Databases and storage

- **Relational**: **PostgreSQL 15+**  
  - Users, documents metadata, annotations, threads, links.  
  - Use **pg_trgm** and built-in full-text search (tsvector/tsquery) for MVP search.

- **Object storage**: **S3** or S3-compatible (**AWS S3**, **MinIO** for local/dev, **Cloudflare R2**).  
  - Document blobs (PDFs, images) and optionally preview assets.

- **Vector DB**: See **§7** for recommendation and rationale.

### 4.4 Real-time and jobs

- **Pub/sub and queues**: **Redis** — pub/sub for collaboration, **BullMQ** for job queues (ingestion, embeddings, AI).
- **WebSockets**: **@fastify/websocket** or **socket.io** with a Redis adapter when you run more than one API instance. See **§8** for why they’re needed and how they plug into the flow.

### 4.5 Search

- **MVP**: **PostgreSQL** full-text + **pg_trgm** for fuzzy match.  
- **Later**: **Meilisearch** or **Typesense** for better search UX if needed.

### 4.6 AI

- **LLM**: HTTP client to **OpenAI**, **Anthropic**, or compatible APIs.  
- **Embeddings**: Same providers (OpenAI/Anthropic embeddings APIs) from Node workers.  
- **Orchestration**: BullMQ jobs that load context (annotations, doc chunks), call the LLM/embeddings API, then write results and citations as annotations.

### 4.7 Observability and ops

- **Logging**: Structured JSON (e.g. **pino**).
- **Metrics**: **OpenTelemetry** or **prom-client** for latency and queue depth.
- **Deployment**: One API process + one worker process for MVP; **Docker** (and **docker-compose**) for local and CI.

---

## 5. Component summary

| Component | Role | Key dependencies |
|-----------|------|-------------------|
| Auth & permissions | Identity, RBAC, token validation | PostgreSQL (or IdP), JWT/OAuth |
| Document service | Upload, store, version, serve URLs | Object storage, PostgreSQL |
| Annotation service | CRUD, threads, anchors, layers | PostgreSQL |
| Collaboration service | Real-time events, presence | WebSockets, Redis pub/sub |
| Search & graph service | Full-text, filters, vectors, link graph | PostgreSQL (FTS, pgvector optional), vector DB later |
| Async / AI layer | Ingestion, embeddings, AI agents | Redis queue, object store, vector DB, LLM API |
| API gateway | Routing, validation, errors | Fastify/FastAPI, auth middleware |

---

## 6. MVP deployment shape

For the MVP (auth, PDF upload/view, highlights + threaded comments, personal + group layers, basic AI explain/summarize, full-text search):

- **One API process** that hosts all sync components and exposes HTTP + WebSocket.
- **One Redis** instance for pub/sub and job queue.
- **One PostgreSQL** instance for relational data and FTS.
- **One object-storage** bucket (or MinIO in dev).
- **One worker process** running ingestion + AI jobs (and later embedding jobs when you add semantic search).

This keeps operations simple while preserving clear boundaries so you can extract services or add new workers as the product grows.

---

## 7. Vector DB: what to use and why

**Recommendation for this stack: pgvector (PostgreSQL extension).**

| Option | Pros | Cons |
|--------|------|------|
| **pgvector** | Same DB as everything else; no new service; ACID; good Node support (`pgvector` npm). Adequate for “related annotations” and MVP semantic search. | Vector search scale and latency can lag dedicated vector DBs at very high dimensions or millions of rows. |
| **Pinecone** | Managed, great DX, strong Node SDK. | Extra service and cost; another moving part for MVP. |
| **Weaviate / Qdrant** | Open source, scalable, built for vectors. | New deployment and ops; more useful once you’re beyond single-DB limits. |

**Why you need a vector store at all:** The spec calls for *semantic search* and *suggested related annotations/documents*. That means comparing *embeddings* (vectors), not just keywords. A vector DB (or PostgreSQL with pgvector) does approximate nearest-neighbour search over those vectors.

**Practical path:** Use **pgvector** in your existing PostgreSQL instance for the MVP. Enable the extension, add an `embeddings` table (or columns) keyed by document/annotation id, and run embedding jobs that write into it. If you outgrow it (e.g. very large corpus or strict latency SLA), introduce Pinecone, Weaviate, or Qdrant and point the embedding pipeline and search API there.

---

## 8. WebSockets: why they’re needed and how they fit in

**Why WebSockets:** The spec requires *real-time updates for annotations* and *&lt;200ms propagation*. When user A creates or edits an annotation, everyone else viewing that document should see it almost immediately. Polling over HTTP would be slow and wasteful; you need the server to *push* events to connected clients. WebSockets (or SSE) provide a long-lived channel for that.

**How they integrate with the rest of the flow:**

1. **Client** opens a WebSocket to the backend and sends a “join” message with `documentId` (and optionally `layer`). The server treats this as joining a *room* for that document/layer.
2. **Annotation CRUD stays on HTTP.** The client creates/updates/deletes annotations via normal REST (e.g. `POST /documents/:id/annotations`). The API validates auth, writes to PostgreSQL, returns 201 + body.
3. **Publish after write.** Right after a successful write, the same API process publishes an event to Redis (e.g. channel `doc:${documentId}`) with payload like `{ type: 'annotation.created', annotation }`.
4. **WebSocket server subscribes to Redis.** The collaboration / WebSocket layer subscribes to those Redis channels. When it receives an event, it pushes the same payload to every WebSocket client in the matching room.
5. **Clients** receive the event over the socket and update local state (e.g. add/update the annotation in the UI). No need to poll.

So: **HTTP for all state changes** (single source of truth, easy to reason about); **WebSockets for broadcasting** those changes to other viewers. Auth is done once at WebSocket upgrade (e.g. via token in query or first message); room membership is enforced so users only get events for documents they’re allowed to see.

**Multi-instance:** When you run more than one API server, each one subscribes to the same Redis channels. Every instance gets every event and can forward it to its own connected clients, so you get a single logical “bus” for real-time updates without tying clients to a specific server.

---

## 9. Next steps / what to start with

Ordered so each step gives you something runnable and the next builds on it.

1. **Scaffold the backend**  
   - Node + TypeScript + Fastify, folder layout (`src/routes`, `src/services`, `src/db`), env config (`DATABASE_URL`, `S3_*`, etc.), `npm run dev` and a health route.

2. **PostgreSQL + schema**  
   - Create DB, add migrations (e.g. with **Drizzle** or **Prisma**). Start with tables: `users`, `documents` (metadata only), `annotations`. Get the app connecting and performing a simple read.

3. **Auth**  
   - Sign-up / login (e.g. email + password), issue JWT. Middleware that validates the token and attaches `user` to the request. Optionally plug in Supabase or Clerk to save implementation time.

4. **Document service**  
   - Wire S3 (or MinIO locally). Implement upload (presigned or server-side), store document metadata in `documents`, and an endpoint to get a download/preview URL. No viewer logic yet.

5. **Annotation service**  
   - CRUD for annotations scoped to a document and user; support at least highlight and comment, plus layers (e.g. `personal` / `group`). This is the core of the product.

6. **Real-time (WebSockets + Redis)**  
   - Add Redis, WebSocket endpoint, and “join document room” semantics. On each annotation create/update/delete, publish to Redis and push to clients in that room. Verify updates appear in a second browser/tab without refresh.

7. **Search**  
   - PostgreSQL full-text on documents and annotations, plus basic filters (by user, layer, doc). Expose via a `GET /search` (or similar) endpoint.

8. **Workers + AI**  
   - BullMQ queue, worker process, and one job type (e.g. “summarize selection”). Worker calls the LLM, then writes the result as an annotation and links it to the source. Ensure failures don’t break annotation persistence.

9. **Vector DB + semantic search (later)**  
   - Enable pgvector, add embedding storage, run embedding jobs from ingestion or annotation changes. Add a “semantic search” or “related annotations” API that queries by vector. This can follow once the above is stable.
