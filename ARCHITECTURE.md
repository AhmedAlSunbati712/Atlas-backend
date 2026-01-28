# Atlas Backend — Architecture

This document reasons from the [product specification](README.md) to a concrete backend architecture: required components, their responsibilities, and a recommended tech stack.

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

Recommendations are chosen for clarity, ecosystem fit, and the ability to start as a single deployable app and split later.

### 4.1 Runtime and API

- **Runtime**: **Node.js** (LTS) or **Python 3.11+**.
- **API**: **Fastify** (Node) or **FastAPI** (Python).
  - Both are fast, support async I/O, OpenAPI, and WebSockets. Fastify fits a TypeScript backend; FastAPI fits heavy use of Python ML/embeddings in the same repo.

**Recommendation**: Prefer **Node.js + TypeScript + Fastify** if the frontend is TypeScript and the team prefers one language end-to-end; prefer **Python + FastAPI** if more logic will live in Python (e.g. embedding and AI code in the same codebase).

### 4.2 Auth

- **Strategy**: JWT access tokens + optional refresh tokens; or OAuth2/OIDC with an identity provider.
- **Libraries**: **Passport.js** + **jsonwebtoken** (Node), or **python-jose** / **Authlib** (Python). Alternatively, **Supabase Auth** or **Clerk** for less custom code.
- **RBAC**: Implement in app logic and middleware using roles and resource ownership stored in the DB.

### 4.3 Databases and storage

- **Relational**: **PostgreSQL 15+**  
  - Metadata, users, annotations, threads, links.  
  - Use **pg_trgm** and full-text search (tsvector/tsquery) for MVP search.  
  - **pgvector** can be used for a single-DB MVP with vectors, or a dedicated vector DB can be introduced when scaling.

- **Object storage**: **S3-compatible** (AWS S3, **MinIO** for local/dev, Cloudflare R2 for cost).  
  - Documents and, if needed, preview assets.

- **Vector DB** (when semantic search is in scope): **pgvector** (simplest), or **Weaviate** / **Qdrant** / **Pinecone** for scale.  
  - MVP can start with pgvector or skip vectors.

### 4.4 Real-time and jobs

- **Pub/sub and queues**: **Redis**  
  - Pub/sub for collaboration events across API instances.  
  - Queues: **BullMQ** (Node) or **Celery** (Python) for ingestion, embeddings, and AI jobs.

- **WebSockets**: **ws** or **socket.io** (Node), or **FastAPI WebSockets** (Python), with Redis adapter when scaling to multiple nodes.

### 4.5 Search

- **MVP**: **PostgreSQL** full-text + **pg_trgm** for fuzzy match.  
- **Later**: **Meilisearch** or **Typesense** for better UX, or **Elasticsearch** if you need rich query DSL and existing Elastic skills.

### 4.6 AI

- **LLM**: HTTP client to **OpenAI**, **Anthropic**, or compatible APIs.  
- **Embeddings**: Same providers or **sentence-transformers** (Python) if you want to run embeddings on your own hardware.  
- **Orchestration**: Worker jobs that load context (annotations, doc chunks), call the API, then write results and citations as annotations.

### 4.7 Observability and ops

- **Logging**: Structured JSON logs (e.g. **pino** in Node, **structlog** in Python).
- **Metrics**: **OpenTelemetry** or app-level metrics (e.g. **prom-client** / **Prometheus**) for latency and queue depth.
- **Deployment**: Single process for API + in-process “services” for MVP; workers as separate processes or containers. **Docker** (and optional **docker-compose**) for local and CI.

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
