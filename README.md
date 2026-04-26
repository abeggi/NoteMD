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
- **Import/Export** — Bulk import/export documents as tar.gz archives

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

# Backend
cd backend
cp .env.example .env
npm install
npm run dev

# Frontend (new terminal)
cd frontend
pnpm install
pnpm run dev
```

## Stack

- **Frontend**: SolidJS, SolidStart, UnoCSS, Milkdown
- **Backend**: Hono, SQLite (better-sqlite3), JWT (jose)

## License

AGPL-3.0. See [LICENSE](LICENSE).
