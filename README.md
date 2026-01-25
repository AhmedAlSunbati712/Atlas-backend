# Atlas — Product Specification

## 1. Overview

**Atlas** is a collaborative platform for sharing, annotating, and connecting documents and files. It allows individuals and groups to read together, think together, and build shared understanding across PDFs, text, code, and images. Atlas combines real-time collaboration, structured annotations, and AI-assisted reading into a single knowledge workspace.

Atlas is designed for students, researchers, engineers, and teams who work with dense information and want more than passive storage or isolated comments.

---

## 2. Problem Statement

Current tools fall into separate silos:

* File storage tools store documents but do not support deep collaboration.
* Annotation tools allow highlights and comments but do not connect ideas across documents.
* Knowledge tools allow linking but lack grounding in source material.

As a result:

* Insights are fragmented across chats, notes, and documents.
* Context is lost over time.
* Collaboration around complex material is shallow and hard to scale.

Atlas solves this by making **annotations first-class, linkable objects** and layering AI directly on top of shared reading activity.

---

## 3. Target Users

### Primary Users

* University students (study groups, classes)
* Researchers (papers, literature reviews)
* Engineers (design docs, code, specs)

### Secondary Users

* Educators
* Writing groups
* Product teams

---

## 4. Core Concepts

### Documents

A document is an immutable content artifact (PDF, text, code, image). Documents are versioned but not edited directly.

### Annotations

Annotations are user-generated objects attached to documents. They may reference text spans, code ranges, or image regions.

### Layers

Annotations exist in layers:

* Personal
* Group
* Public

Layers can be toggled on/off independently.

### Links

Annotations can be linked to other annotations, forming a graph of connected ideas across documents.

### AI Artifacts

AI-generated outputs (summaries, explanations, suggestions) are stored as annotations and treated the same as human contributions.

---

## 5. Functional Requirements

### 5.1 Document Management

* Upload PDFs, text/markdown files, code files, and images
* Store document metadata (type, owner, permissions)
* Generate previews and page-level navigation
* Support multiple versions of the same document

---

### 5.2 Annotation System

#### Annotation Types

* Highlight
* Comment (threaded)
* Inline note
* Link
* Tag

#### Annotation Capabilities

* Create, edit, delete annotations
* Threaded discussions on annotations
* Reactions (emoji, upvotes)
* Resolve / reopen threads

#### Anchoring

* Text-based anchors (offset + context)
* Code anchors (file + line range)
* Image anchors (bounding boxes)

Anchors must remain stable across minor document version changes.

---

### 5.3 Collaboration

* Real-time updates for annotations
* Presence indicators (who is viewing)
* Activity feed
* Notifications for replies, mentions, and links

Initial implementation may use last-write-wins conflict resolution.

---

### 5.4 Cross-Document Linking

* Create links between annotations on different documents
* Define relationship types (e.g. implements, contradicts, supports)
* Visualize links in a graph view
* Navigate between linked annotations

---

### 5.5 Search & Discovery

* Full-text search over documents and annotations
* Filter by user, layer, tag, document
* Semantic search using embeddings
* Suggested related annotations and documents

---

### 5.6 AI-Assisted Reading

AI agents can:

* Summarize selected annotations
* Explain highlighted math or code
* Suggest links to other annotations or documents
* Answer questions grounded in annotations

AI outputs must:

* Cite source annotations
* Be stored as annotations
* Be editable or dismissible by users

---

## 6. Non-Functional Requirements

### Performance

* Annotation updates should propagate in under 200ms
* Document rendering must be smooth for large PDFs

### Scalability

* Support hundreds of concurrent users per document
* Async processing for AI tasks

### Security

* Role-based access control
* Private annotations visible only to owners
* Secure file storage

### Reliability

* Annotations must never be lost
* AI failures must not block core functionality

---

## 7. System Architecture (High-Level)

### Frontend

* Document viewer (PDF, code, text)
* Annotation overlay layer
* Graph visualization
* Collaboration UI

### Backend Services

* Auth & permissions service
* Document service
* Annotation service
* Collaboration service
* Search & graph service

### Async / AI Layer

* Ingestion workers
* Embedding generation
* AI agent workers

### Storage

* Object storage for documents
* Relational DB for metadata and annotations
* Vector DB for embeddings

---

## 8. MVP Scope

The MVP must include:

* User authentication
* PDF upload and viewing
* Highlights and threaded comments
* Layered annotations (personal + group)
* Basic AI explain/summarize
* Full-text search

The MVP explicitly excludes:

* Real-time cursors
* Repo-level code support
* Advanced CRDT conflict resolution

---

## 9. Success Metrics

* Number of annotations per document
* Active collaborative sessions
* Reuse of annotations across documents
* AI feature engagement rate

---

## 10. Future Extensions

* Live multi-cursor collaboration
* Code repository ingestion
* Study guide generation
* Argument/debate modes
* External integrations (LMS, GitHub, Google Drive)

---

## 11. Design Principles

* Annotations over chat
* AI as collaborator, not authority
* Ground all insights in source material
* Favor explicit structure over freeform text

---

## 12. Open Questions

* Best anchoring strategy for heavily edited documents
* Moderation model for public annotations
* Long-term storage costs for embeddings

---

**Atlas aims to be infrastructure for thinking together, not just reading together.**
