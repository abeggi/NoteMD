# NoteMD

Self-hosted markdown editor with live preview, document encryption, multi-user support, and multi-organization capabilities.

## Features

- **Live preview** — WYSIWYG markdown editing with real-time rendering
- **Encryption** — AES-256 document encryption at rest
- **Multi-user** — Create accounts for team members with role-based access
- **Multi-organization** — Manage separate workspaces within the same instance
- **Full-text search** — Search across all documents instantly
- **Attachments** — Upload and embed images, PDFs, and files in documents
- **Mermaid diagrams** — Render diagrams and flowcharts inline
- **Math** — LaTeX math via KaTeX
- **Import/Export** — Bulk import/export documents as tar.gz archives, single-document DOCX export

## Quick start

### Docker

```bash
docker run -d \
  --name notemd \
  -p 3000:3000 \
  -v notemd-data:/data \
  ghcr.io/abeggi/NoteMD:latest
```

Access at `http://localhost:3000`.

### Docker Compose

```bash
git clone https://github.com/abeggi/NoteMD.git
cd NoteMD
cp .env.example .env
# edit .env with your secrets
docker compose up -d
```

### From source

```bash
git clone https://github.com/abeggi/NoteMD.git
cd NoteMD
cp .env.example .env
# edit .env with your JWT_SECRET and ENCRYPTION_KEY

# Install dependencies and start both services
./start.sh start
```

Access at `http://localhost:3000`. Use `./start.sh stop` to stop, `./start.sh status` to check.

#### Manual start (two terminals)

```bash
# Terminal 1 — Backend
cd backend
cp .env.example .env
npm install
npm run dev

# Terminal 2 — Frontend
cd frontend
pnpm install
pnpm run dev
```

#### Environment variables

| Variable | Default | Description |
|---|---|---|
| `BACKEND_INTERNAL_PORT` | `3001` | Backend API port |
| `DB_PATH` | `../data/notemd.db` | SQLite database path (relative to `backend/`) |
| `DOCUMENTS_PATH` | `../data/documents` | Document storage path (relative to `backend/`) |
| `JWT_SECRET` | — | Secret for JWT token signing |
| `ENCRYPTION_KEY` | — | 64-char hex string for AES-256 (only when `ENABLE_ENCRYPTION=true`) |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `VITE_API_URL` | `http://localhost:3001` | Backend URL for the frontend |

## Stack

- **Frontend**: SolidJS, SolidStart, UnoCSS, Milkdown
- **Backend**: Hono, SQLite (better-sqlite3), JWT (jose)

## License

AGPL-3.0. See [LICENSE](LICENSE).
