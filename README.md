# Project Teams

Team chat, shared docs and an AI knowledge base you can ask questions, in one workspace.

## What's in it today

- **Chat**: public and private channels, DMs and group DMs, threads, @mentions, file and image sharing, edit/delete, unread counts, typing indicators, online presence and a notifications inbox.
- **Docs**: rich-text editor (headings, lists, checklists, links, code) with auto-save, version history and restore, folders, personal stars, and AI summaries, tags and rewriting.
- **Knowledge**: ask a question and get an answer from your workspace with numbered, clickable sources. Docs, uploaded files (PDF, text, Markdown, CSV) and public channels are indexed automatically; private channels and DMs never are (RAG on MongoDB Atlas Vector Search).
- **Search**: Ctrl/⌘K searches docs, files and the messages you can see.
- **AI in chat**: "Catch up" summarises the last 24 hours of a conversation; "Turn into doc" writes a doc from a thread.
- **Workspaces**: create workspaces, invite people by link or email, owner/admin/member roles, switch between workspaces.
- **Sign-in**: email + password or Google; password reset by email; light and dark themes.

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
                        auth, users, workspaces, invites, docs, chat, ai, knowledge
      scripts/          one-off jobs (e.g. migrate:workspaces)
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

(`numDimensions` must match `EMBEDDING_MODEL`; `gemini-embedding-001` returns 3072.) Docs and chat chunks use the same index; nothing to change if you already have it.

Indexing runs in the worker (`npm run worker` / PM2), so Redis and the worker must be up for docs, files and channels to become searchable. Docs are re-indexed about 30 seconds after the last edit, channels about a minute after new messages. `QUEUE_DISABLED=true` turns the queue off (tests use it).

## Checks

```bash
npm run typecheck     # both apps
npm test              # API tests; first run downloads a MongoDB binary for the in-memory DB
npm run lint --prefix apps/web
```

CI runs all of these on every push and pull request.

### Upgrading from team codes

Accounts created before workspaces existed shared an 8-digit team code. Each code becomes a workspace called "Team <code>" the first time one of its members signs in. The earliest member becomes the owner and can rename it; docs, files and chats move with it. To convert every team at once instead:

```bash
cd apps/api && npm run build && npm run migrate:workspaces
```

### Upgrading docs

Docs written in the old plain-text editor are converted to rich text the first time they're opened, old embedded versions move into the new history, and the old team-wide star becomes a personal star for the doc's author. Nothing to run.

### Upgrading chat history

Old one-to-one chats are copied into the new conversations (with their original timestamps) the first time anyone in the workspace opens Chat. Nothing to run.

## Deploying

Production is one origin: Nginx serves `apps/web/dist` and proxies `/api` and `/socket.io` to the API on localhost. PM2 runs the API and the worker from compiled output.

```bash
./deploy/deploy.sh    # pull, build both apps, reload PM2
```

See [`deploy/nginx.conf.example`](deploy/nginx.conf.example) and [`apps/api/ecosystem.config.cjs`](apps/api/ecosystem.config.cjs).

## Roadmap

1. ✅ Lockdown: auth on every route and socket, team isolation, safe password reset
2. ✅ Foundations: TypeScript API in modules, tests, CI, React Query
3. ✅ Workspaces: real workspaces, invite links, roles, Google sign-in, onboarding, light theme
4. ✅ Chat v2: channels, threads, unread counts, real presence, notifications
5. ✅ Docs v2 + Knowledge: rich-text editor, one searchable knowledge base, cited answers
6. Business: billing, audit log, export
7. Collaboration: live co-editing, comments, integrations
