# AGENTS.md

## Project overview

NoteMD is a self-hosted markdown editor with document encryption, multi-user, and multi-organization support. Two-package monorepo.

## Package managers differ per workspace

- **`backend/`** — `npm`
- **`frontend/`** — `pnpm`

Using the wrong manager in either directory will fail.

## Development

```bash
# Backend (terminal 1)
cd backend
cp .env.example .env   # required; loads via dotenv in config.ts
npm install
npm run dev             # tsx watch src/index.ts, port 3001

# Frontend (terminal 2)
cd frontend
pnpm install
pnpm run dev            # vinxi dev, port 3000, proxies /api/** to :3001
```

Node 20 is required (see `.nvmrc` files).

## Backend

- **Runtime**: Hono on `@hono/node-server`, listens on `BACKEND_INTERNAL_PORT` (default `3001`).
- **Database**: SQLite via `better-sqlite3` with WAL mode. Created at `DB_PATH` (default `./data/notemd.db`) on first run.
- **Migrations**: Run automatically on startup (`backend/src/db/index.ts`). Manual CLI available:
  - `npm run migrate:status` — show pending/applied
  - `npm run migrate:run` — apply pending
  - `npm run migrate:create <name>` — scaffold a migration file; **must then register it in `backend/src/db/migrations/index.ts`**
- **Encryption**: Optional AES-256. When `ENABLE_ENCRYPTION=true`, `ENCRYPTION_KEY` must be exactly 64 hexadecimal characters (32 bytes).
- **Documents**: Stored as `.md` files on disk under `DOCUMENTS_PATH/org-{id}/`, with `.meta.json` sidecar files for color/favorite metadata.
- **zod is v4**: Note the `z.treeifyError()` API — different from zod v3.
- **No build step needed for dev** — `tsx watch` runs TypeScript directly.
- **Build for production**: `npm run build` (tsc) → `npm run start` (node dist/index.js).

## Frontend

- **Stack**: SolidJS + SolidStart + Vinxi + UnoCSS + Milkdown (markdown editor).
- **Dev server** proxies `/api/**` to `http://localhost:3001/api/**` (configured in `app.config.ts`).
- **Build**: `pnpm build` (vinxi build) → `.output/` directory.
- **Production**: `pnpm start` (vinxi start) or `node .output/server/index.mjs`.
- Environment: uses `VITE_API_URL` for backend API URL.

## Docker

- Single-container image hosting both frontend and backend.
- `npm run docker:build` (root) — builds the image.
- `docker-start.sh` starts both services inside the container.
- Exposes ports 3000 (frontend) and 3001 (backend API).

## No tests, no lint, no CI

There are no test suites, lint rules, formatters, typecheck scripts, or CI workflows in this repo. If adding tooling, don't assume any pre-existing configuration.

## Agent rules

- **Never** run Docker builds or pushes (`docker build`, `docker buildx`, `npm run docker:build`, `npm run docker:publish`) unless the user explicitly asks.
- **Never** run `git commit` or `git push` unless the user explicitly asks.
- **Never** restart services (`./start.sh restart`, `kill`, manual process management) unless the user explicitly asks.
- When in doubt whether an action is a side-effect, ask first.
