# Beacon

Navigate open source like you've been there before.

Paste a GitHub repo URL. Beacon's AI agent explores it — reading issues, PRs, contributors, and code — then returns ranked contribution opportunities, an architecture overview, a health snapshot, and the best files to start with.

## Quick start

```bash
cp .env.example .env
# Add your OPENROUTER_API_KEY
docker compose up --build
```

Open http://localhost:5173

## Stack

- **Frontend** — Vite + React + TypeScript
- **Backend** — Node.js 24 + Express + TypeScript
- **Database** — Postgres 18
- **AI** — OpenRouter (`gpt-4o-mini` by default)
- **Streaming** — WebSocket (live agent feed)

## Local dev

```bash
make dev-db          # Postgres only
make dev-backend     # backend with hot reload
make dev-frontend    # Vite dev server
make test            # run all tests
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `GITHUB_TOKEN` | No | Increases GitHub rate limits |
| `OPENROUTER_MODEL` | No | Override the default model |

## Roadmap

See [ROADMAP.md](./ROADMAP.md).
