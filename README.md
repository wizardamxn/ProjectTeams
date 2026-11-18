# Project Teams

Team chat, shared docs and an AI knowledge base you can ask questions, in one workspace.

## What's in it today

- **Chat**: 1:1 messages between teammates over Socket.IO.
- **Docs**: write, tag, star and version team documents, with AI summaries, tags and editing.
- **Knowledge**: upload PDFs and text files, index them, and ask questions answered only from your team's files (RAG on MongoDB Atlas Vector Search).
- **Teams**: everyone with the same 8-digit team code shares one workspace (real workspaces and invites arrive in Phase 3).

## Repo layout

```
apps/
  api/                Express 5 + TypeScript API, Socket.IO, BullMQ worker
    src/
      config.ts         every env var, validated at boot (zod)
      app.ts            builds the Express app (used by server + tests)
      server.ts         HTTP + sockets entry point
      worker.ts         RAG indexing worker entry point
      lib/              logger, errors, db, redis, storage, mailer, ai
      middleware/       auth, rate limits, validation, error handler
      models/           Mongoose models
      modules/<name>/   routes → service (+ schemas) per feature:
                        auth, users, docs, chat, ai, knowledge
      realtime/         Socket.IO handlers + presence
      queues/           BullMQ queue + worker
    test/               Vitest: unit (no DB) + integration (in-memory MongoDB)
  web/                React 18 + Vite + TypeScript (strict)
    src/
      lib/api.ts        the one HTTP client (cookies, 401 handling, errors)
      api/              React Query hooks per feature + shared types
      store/            Redux: session user + live chat only
      pages/            routes
      components/       layout, command palette, UI kit
deploy/               Nginx example + deploy script
.github/workflows/    CI
```

Server data is fetched with React Query (`src/api/*`); Redux only holds the logged-in user and the live chat stream.

## Running locally

Needs Node 20+, a MongoDB Atlas cluster (vector search is Atlas-only), and Redis.

```bash
cp apps/api/.env.example apps/api/.env      # fill in MONGO_URI, JWT_KEY, ...
cp apps/web/.env.example apps/web/.env
npm run install:all

npm run dev:api       # http://localhost:2222
npm run dev:worker    # RAG indexing (needs Redis)
npm run dev:web       # http://localhost:8080
```

Or run everything (plus Redis) with `docker compose up`.

Every API setting is documented in [`apps/api/.env.example`](apps/api/.env.example) and validated by `apps/api/src/config.ts`. The API refuses to start if a required one is missing.

### Atlas vector index

Create a vector search index named `rag_chunk_vector_index` on the `ragchunks` collection:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 3072, "similarity": "cosine" },
    { "type": "filter", "path": "teamId" }
  ]
}
```

(`numDimensions` must match `EMBEDDING_MODEL`; `gemini-embedding-001` returns 3072.)

## Checks

```bash
npm run typecheck     # both apps
npm test              # API tests; first run downloads a MongoDB binary for the in-memory DB
npm run lint --prefix apps/web
```

CI runs all of these on every push and pull request.

## Deploying

Production is one origin: Nginx serves `apps/web/dist` and proxies `/api` and `/socket.io` to the API on localhost. PM2 runs the API and the worker from compiled output.

```bash
./deploy/deploy.sh    # pull, build both apps, reload PM2
```

See [`deploy/nginx.conf.example`](deploy/nginx.conf.example) and [`apps/api/ecosystem.config.cjs`](apps/api/ecosystem.config.cjs).

## Roadmap

1. ✅ Lockdown: auth on every route and socket, team isolation, safe password reset
2. ✅ Foundations: TypeScript API in modules, tests, CI, React Query
3. Workspaces: real teams, invite links, roles, Google sign-in, onboarding
4. Chat v2: channels, threads, unread counts, real presence, notifications
5. Docs v2 + Knowledge: rich-text editor, one searchable knowledge base, cited answers
6. Business: billing, audit log, export
7. Collaboration: live co-editing, comments, integrations
